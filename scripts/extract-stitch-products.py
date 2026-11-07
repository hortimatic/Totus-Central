"""Preserve the approved Stitch module; exclude the editor runtime and global shell.

Run only against the saved, user-approved DOM export. No network or shop writes.
"""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'design-reference/stitch-products/console.original.html'
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def html(self):
        if not self.tag:
            return ''.join(c.html() if isinstance(c, Node) else c for c in self.children)
        attrs = ''.join(' '+k+'="'+escape(v or '', quote=True)+'"' for k,v in self.attrs.items())
        return '<'+self.tag+attrs+'>'+('' if self.tag in VOID else ''.join(c.html() if isinstance(c,Node) else c for c in self.children)+'</'+self.tag+'>')
    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.walk()

class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = self.current = Node()
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs,self.current);self.current.children.append(node)
        if tag not in VOID:self.current=node
    def handle_endtag(self,tag):
        p=self.current
        while p.parent and p.tag!=tag:p=p.parent
        if p.parent:self.current=p.parent
    def handle_data(self,s):self.current.children.append(s)
    def handle_entityref(self,s):self.handle_data('&'+s+';')
    def handle_charref(self,s):self.handle_data('&#'+s+';')

raw=SOURCE.read_text(encoding='utf-8')
tree=Tree();tree.feed(raw)
main=next(n for n in tree.root.walk() if n.tag=='main')
nodes=list(main.walk())
controls=[]
for n in nodes:
    if n.tag in ('button','input','select','textarea'):
        controls.append({'tag':n.tag,'id':n.attrs.get('id'),'type':n.attrs.get('type'),
                         'prototype_action':n.attrs.get('onclick') or n.attrs.get('onchange') or n.attrs.get('oninput'),
                         'text':''.join(c for c in n.children if isinstance(c,str)).strip()})
    # Prototype handlers may simulate success or use demo records. They NEVER ship.
    n.attrs={k:v for k,v in n.attrs.items() if not k.startswith('on') and not k.startswith('data-stitch')}
    n.attrs.pop('contenteditable',None)
styles=[''.join(c for c in n.children if isinstance(c,str)) for n in tree.root.walk()
        if n.tag=='style' and not any(k.startswith('data-stitch') for k in n.attrs)]
# Keep the compiled design stylesheet, not editor resets that hide all scrollbars.
css=max(styles,key=len)
views={n.attrs['id']:n.html() for n in nodes if n.attrs.get('id','').startswith(('tab-','sub-'))}
shell=next(n for n in main.children if isinstance(n,Node))
header=next(n for n in shell.children if isinstance(n,Node) and n.tag=='section').html()
payload='// Generated from the approved Stitch export. Regenerate with scripts/extract-stitch-products.py.\n'
payload+='export const STITCH_HEADER='+json.dumps(header,ensure_ascii=False)+';\n'
payload+='export const STITCH_VIEWS='+json.dumps(views,ensure_ascii=False)+';\n'
(ROOT/'src/productos-stitch-template.js').write_text(payload,encoding='utf-8')
(ROOT/'src/productos-stitch.css').write_text('/* Original compiled Stitch CSS, isolated from other modules. */\n@scope (#productosRoot .prd-stitch) {\n'+css+'\n}\n',encoding='utf-8')
(SOURCE.parent/'controls.json').write_text(json.dumps(controls,ensure_ascii=False,indent=2),encoding='utf-8')
(SOURCE.parent/'provenance.json').write_text(json.dumps({'project':'5869856515258186560','node':'6572b3976ec14951908a50d400cbf949','source_sha256':hashlib.sha256(raw.encode()).hexdigest(),'controls':len(controls),'views':list(views),'status':'reference only; prototype handlers excluded'},indent=2),encoding='utf-8')
print(f'Extracted {len(views)} views and {len(controls)} controls; original classes and CSS preserved.')
