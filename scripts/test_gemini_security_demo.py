"""Real Gemini inference and independent Docker verification of a local sample.
Only this fictitious sample is sent to Gemini. No implicit provider fallback.
"""
from pathlib import Path
import json, os, re, shutil, subprocess, tempfile
from agent.generator import generate_patch
from backend.config import Settings
from backend.policy import validate_patch, patch_hash
from verification.patch_validator import PatchValidator, PatchValidationError
from verification.evaluator import TestResultEvaluator
from verification.adapter import verify_backend_patch

ROOT=Path(__file__).resolve().parents[1]
SAMPLE=ROOT/'samples/gemini-security-demo'

def load_configuration():
    for name in ('.env.example','.env'):
        path=ROOT/name
        if path.exists():
            for line in path.read_text(encoding='utf-8-sig').splitlines():
                match=re.fullmatch(r'\s*([A-Z][A-Z0-9_]*)\s*=(.*)',line)
                if match: os.environ[match[1]]=match[2].strip().strip('"'+chr(39))
    os.environ['SENTINEL_LLM_PROVIDER']='gemini'
    os.environ['SENTINEL_PROVIDER_RETRIES']='2'
    os.environ['SENTINEL_NEATLOGS_MODE']='off'
    os.environ['NEATLOGS_API_KEY']=''

def docker_tests(work, name):
    report=work/name
    report.mkdir()
    os.chmod(work,0o777); os.chmod(report,0o777)
    command=['docker','run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--cpus','1','--memory','512m','--pids-limit','64','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','-e','PYTHONDONTWRITEBYTECODE=1','-e','PYTHONPATH=/workspace','-e','VERIFICATION_REPORT_PATH=/workspace/report/test_report.json','--mount',f'type=bind,source={work / "app"},target=/workspace/verification/lab/app,readonly','--mount',f'type=bind,source={ROOT / "verification/protected_tests"},target=/workspace/verification/protected_tests,readonly','--mount',f'type=bind,source={report},target=/workspace/report','sentinel-verification-lab:latest','python','-m','pytest','-p','no:cacheprovider','/workspace/verification/protected_tests','-q']
    completed=subprocess.run(command,capture_output=True,text=True,timeout=90)
    path=report/'test_report.json'
    evidence=TestResultEvaluator.evaluate(job_id='gemini-sample-proof',patch_hash='sha256:'+'0'*64,exit_code=completed.returncode,raw_output='',report_json_str=path.read_text() if path.exists() else None)
    return {'status':evidence.status,'tests_total':evidence.tests_total,'tests_passed':evidence.tests_passed,'tests_failed':evidence.tests_failed,'test_results':[{'name':t['nodeid'],'outcome':t['outcome']} for t in json.loads(path.read_text()).get('tests',[])] if path.exists() else [],'execution_error':evidence.execution_error}

def main():
    load_configuration()
    original=(SAMPLE/'app/access.py').read_text(encoding='utf-8')
    result={'provider':'gemini','model':os.getenv('SENTINEL_GEMINI_MODEL','provider default'),'ai_generated':False,'source':'samples/gemini-security-demo/app/access.py','checks':{}}
    try:
        if not os.getenv('GEMINI_API_KEY'): raise RuntimeError('Gemini key is not configured')
        subprocess.run(['docker','info'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=30)
        with tempfile.TemporaryDirectory(prefix='sentinel-gemini-') as temp:
            work=Path(temp)
            shutil.copytree(SAMPLE/'app',work/'app')
            result['baseline']=docker_tests(work,'baseline')
            print('Vulnerable baseline: '+json.dumps(result['baseline']),flush=True)
            assert result['baseline']['tests_failed']==4 and result['baseline']['tests_passed']==4
            finding={'id':'GEMINI-SAMPLE-001','type':'BROKEN_OBJECT_LEVEL_AUTHORIZATION','severity':'HIGH','file_path':'app/access.py','description':'The uploaded sample returns private documents without checking the requesting user against owner_id.'}
            print('Requesting actual Gemini patch...',flush=True)
            proposal=generate_patch(finding,{'app/access.py':original},0)
            result['ai_generated']=True
            (SAMPLE/'gemini-proposal.json').write_text(json.dumps(proposal,indent=2),encoding='utf-8')
            patch=proposal['patch_text']; digest=patch_hash(patch)
            settings=Settings(database_path=work/'unused.db',source_root=work)
            policy=validate_patch('bola-demo-v1',patch,proposal['files_changed'],0,settings)
            assert policy.allowed,policy.reasons
            result['checks']['backend_policy']=True
            PatchValidator.validate_patch(patch,digest)
            result['checks']['verifier_policy']=True
            try: PatchValidator.validate_patch(patch+'\n',digest)
            except PatchValidationError: result['checks']['tampered_patch_rejected']=True
            else: raise AssertionError('Tampered patch accepted')
            rejected=verify_backend_patch({'job_id':'sample-job','target_app_id':'bola-demo-v1','patch_id':'sample-patch','patch_text':patch,'patch_hash':digest,'approval_id':'unapproved'},lambda *args:False)
            assert rejected['status']=='EXECUTION_ERROR' and 'Approval validation failed' in rejected['execution_error']
            result['checks']['missing_approval_rejected']=True
            patch_file=work/'candidate.patch'; patch_file.write_text(patch,encoding='utf-8',newline='\n')
            apply=subprocess.run(['patch','-p1','--batch','--forward','--fuzz=0','--input',str(patch_file)],cwd=work,capture_output=True,text=True,timeout=15)
            assert apply.returncode==0,'Gemini patch could not be applied'
            result['checks']['patch_applies_to_actual_sample']=True
            result['patched']=docker_tests(work,'patched')
            result['patch_hash']=digest
            (SAMPLE/'gemini.patch').write_text(patch,encoding='utf-8',newline='\n')
            (SAMPLE/'access.fixed.py').write_bytes((work/'app/access.py').read_bytes())
            result['checks']['original_sample_unchanged']=(SAMPLE/'app/access.py').read_text(encoding='utf-8')==original
            assert result['patched']['status']=='VERIFIED' and result['patched']['tests_passed']==8,result['patched']
            print('Actual Gemini patch: VERIFIED, 8 passed / 0 failed',flush=True)
    except Exception as error:
        # Do not expose provider URLs, key, prompt, or raw exception strings.
        result['error_category']=getattr(error,'failure_type',None) or type(error).__name__
        print('Proof failed: '+result['error_category'],flush=True)
        raise
    finally:
        (SAMPLE/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')

if __name__=='__main__': main()
