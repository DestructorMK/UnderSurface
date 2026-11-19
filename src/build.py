import re
t=open('template.html').read()
sim=open('sim.js').read().split("if (typeof module")[0]
js=sim+"\n"+open('art.js').read()+"\n"+open('app.js').read()
t=t.replace('/*CSS*/',open('style.css').read()).replace('/*JS*/',js)
import os; os.makedirs('dist',exist_ok=True)
open('dist/index.html','w').write(t)
print(len(t))
