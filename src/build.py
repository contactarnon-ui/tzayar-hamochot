import json,re
T='/home/claude/tzayar/'
_rd=lambda f:open(T+f,encoding='utf8').read()
KNN=_rd('knn.js')
rd=lambda f:_rd(f).replace('/*__KNN__*/',KNN)
w=rd('worker.js')
for imp in ["import { WORDS, WFILTER, wordProblem } from './words.js';\n","import APP from './app.html';\n","import SIM from './sim.html';\n","import { ICONS } from './icons.js';\n"]:
    assert imp in w; w=w.replace(imp,'')
w="// צייר המוחות – קובץ אחד להדבקה בעורך של Cloudflare\n"+"const BOTS = "+open('/home/claude/qd/botdata.json',encoding='utf8').read()+";\n"+rd('words.js').replace('export const','const').replace('export function','function')+rd('icons.js').replace('export const','const')+"const APP = "+json.dumps(rd('app.html'),ensure_ascii=False)+";\nconst SIM = "+json.dumps(rd('sim.html'),ensure_ascii=False)+";\n"+w.replace('export function','function')
open('/home/claude/worker-full.js','w',encoding='utf8').write(w)
# solo
W=json.dumps(json.loads(rd('words.js').split('WORDS = ',1)[1].split(';\n',1)[0]),ensure_ascii=False)
F=rd('words.js').split('WFILTER = ',1)[1].split(';\n',1)[0]
shim=rd('demo-shim.js').replace('/*__WORDS__*/null',W).replace('/*__FILTER__*/null',F)
a=rd('app.html').replace('/*__WORDS__*/null',W).replace('/*__FILTER__*/null',F).replace('__ORIGIN__','')
a=re.sub(r'<link rel="manifest"[^>]*>\n|<link rel="icon"[^>]*>\n|<link rel="apple-touch-icon"[^>]*>\n|<link rel="canonical"[^>]*>\n','',a)
open('/home/claude/demo/app.html','w',encoding='utf8').write(a.replace('<style>','<script>'+shim+'</script>\n<style>',1))
open('/home/claude/צייר-המוחות.html','w',encoding='utf8').write(a.replace('<style>','<script>'+shim.replace('window.__DEMO=true;','window.__DEMO=true;window.__SOLO=true;')+'</script>\n<style>',1))
print('built',len(w))

# גרסת דיו
wi=w.replace("/*__MODE__*/'curse'","/*__MODE__*/'ink'")
assert wi.count("/*__MODE__*/'ink'")==2, wi.count("/*__MODE__*/'ink'")
open('/home/claude/worker-ink.js','w',encoding='utf8').write(wi.replace('// צייר המוחות – קובץ אחד','// צייר המוחות (גרסת דיו) – קובץ אחד',1))
print('built ink')

# גרסת דיו על הכתובת הראשית – אותם שחקנים ומוחות (בלי קידומת ink)
a="return MODE === 'ink' ? 'ink' + b : b;"
assert a in wi
open('/home/claude/worker-ink-main.js','w',encoding='utf8').write(wi.replace(a,"return b;").replace('const NS_PLAIN = false;','const NS_PLAIN = true;'))
print('built ink-main')
