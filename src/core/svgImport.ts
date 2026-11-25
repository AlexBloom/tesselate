import { initialShape, initialDocument, validDocument, multiply } from './geometry.ts'
import type { Shape, Matrix, Point } from './geometry.ts'
import { geometryPoints, mapGeometry, pathBounds } from './network.ts'
import { parsePath } from './svgPath.ts'
import type { Gradient } from './paint.ts'
const identity:Matrix=[1,0,0,1,0,0]
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n))
const box=(p:Point[])=>{const x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));return {x,y,w:Math.max(...p.map(p=>p.x))-x,h:Math.max(...p.map(p=>p.y))-y}}
function matrix(transforms:string[]):Matrix{const g=parsePath('M0 0 L1 0 L0 1',transforms),[a,b,c]=g.points;return [b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y]}
export function importSVG(text:string,layerId:string,id:()=>string):{shapes:Shape[];warnings:string[]}{
  if(text.length>2000000)throw new Error('SVG files must be under 2 MB.')
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('SVG documents with entities or a document type are not supported.')
  const xml=new DOMParser().parseFromString(text,'image/svg+xml'),root=xml.documentElement
  if(root.localName!=='svg'||xml.querySelector('parsererror'))throw new Error('This is not a valid SVG document.')
  if(xml.getElementsByTagName('*').length>5000)throw new Error('SVG contains too many elements.')
  const warnings=new Set<string>(),shapes:Shape[]=[]
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!
  function color(value:string){if(!CSS.supports('color',value)||/var\(/.test(value))throw new Error(`Unsupported color ${value}`);canvas.width=1;canvas.height=1;ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const [r,g,b,a]=ctx.getImageData(0,0,1,1).data;return {color:'#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''),opacity:a/255}}
  const rules:{selector:string;values:Record<string,string>}[]=[]
  const declarations=(value:string)=>Object.fromEntries(value.split(';').map(s=>s.split(':').map(v=>v.trim())).filter(v=>v.length===2))
  for(const style of Array.from(xml.querySelectorAll('style')))for(const match of (style.textContent??'').matchAll(/([^{}]+)\{([^{}]+)\}/g))for(const selector of match[1].split(','))rules.push({selector:selector.trim(),values:declarations(match[2])})
  if(rules.length>1000)throw new Error('SVG contains too many CSS rules.')
  const keys=['fill','stroke','stroke-width','fill-rule','stroke-linecap','stroke-linejoin','stroke-dasharray','vector-effect','fill-opacity','stroke-opacity','opacity','display','visibility','color','stop-color','stop-opacity','clip-path','mask','filter']
  function style(el:Element,parent:Record<string,string>){const result:Record<string,string>={...parent,opacity:'1'};for(const key of keys)if(el.hasAttribute(key))result[key]=el.getAttribute(key)!;for(const rule of rules)try{if(el.matches(rule.selector))Object.assign(result,rule.values)}catch{warnings.add('Some CSS selectors were not supported.')}Object.assign(result,declarations(el.getAttribute('style')??''));for(const key of Object.keys(result))if(result[key]==='inherit'){if(parent[key]!==undefined)result[key]=parent[key];else delete result[key]}return result}
  function gradient(ref:string,local:Shape,transforms:string[]):Gradient|undefined{
    const target=xml.getElementById(ref);if(!target||!['linearGradient','radialGradient'].includes(target.localName)){warnings.add('Unsupported paint server was omitted.');return}
    let stops=Array.from(target.children).filter(e=>e.localName==='stop');const href=target.getAttribute('href')??target.getAttribute('xlink:href');if(!stops.length&&href?.startsWith('#'))stops=Array.from(xml.getElementById(href.slice(1))?.children??[]).filter(e=>e.localName==='stop')
    if(stops.length<2||stops.length>8){warnings.add('Gradients need 2–8 stops; unsupported gradients were omitted.');return}
    const percent=(v:string|null,def:number)=>v===null?def:v.endsWith('%')?Number.parseFloat(v)/100:Number(v)
    const view=(root.getAttribute('viewBox')??'').trim().split(/[ ,]+/).map(Number),vw=view.length===4?view[2]:Number.parseFloat(root.getAttribute('width')??'')||300,vh=view.length===4?view[3]:Number.parseFloat(root.getAttribute('height')??'')||150,userSpace=target.getAttribute('gradientUnits')==='userSpaceOnUse'
    const coord=(key:string,def:number)=>{const value=target.getAttribute(key),n=percent(value,def);return userSpace&&(value===null||value.endsWith('%'))?n*(key==='r'?Math.hypot(vw,vh)/Math.SQRT2:key.endsWith('x')||key==='x1'||key==='x2'?vw:vh):n}
    const geometry:NonNullable<Gradient['geometry']>={}
    for(const [key,def] of Object.entries(target.localName==='linearGradient'?{x1:0,y1:0,x2:1,y2:0}:{cx:.5,cy:.5,r:.5})){geometry[key as keyof typeof geometry]=coord(key,def)}
    for(const key of ['fx','fy'] as const)if(target.hasAttribute(key))geometry[key]=coord(key,.5)
    const localBox=pathBounds(local),space=userSpace?identity:[localBox.w||1,0,0,localBox.h||1,localBox.x,localBox.y] as Matrix
    const transform=multiply(matrix(transforms),multiply(space,matrix([target.getAttribute('gradientTransform')??''])))
    if(target.hasAttribute('spreadMethod')&&target.getAttribute('spreadMethod')!=='pad')warnings.add('Gradient spread methods are rendered as pad.')
    return {units:'userSpaceOnUse',type:target.localName==='radialGradient'?'radial':'linear',angle:0,geometry,transform,stops:stops.map(stop=>{const s=style(stop,{}),paint=color(s['stop-color']??'#000000');return {offset:clamp(percent(stop.getAttribute('offset'),0)),color:paint.color,opacity:paint.opacity*clamp(Number(s['stop-opacity']??1))}}).sort((a,b)=>a.offset-b.offset)}
  }
  function path(el:Element){const n=(k:string,d=0)=>{const value=el.getAttribute(k);if(value&&/[^\d.eE+-]/.test(value))warnings.add('SVG shape units are interpreted as pixels.');return Number.parseFloat(value??'')||d},tag=el.localName
    if(tag==='path')return el.getAttribute('d')??''
    if(tag==='line')return `M${n('x1')} ${n('y1')} L${n('x2')} ${n('y2')}`
    if(tag==='polyline'||tag==='polygon'){const values=el.getAttribute('points')?.trim();return values?`M${values}${tag==='polygon'?' Z':''}`:''}
    if(tag==='rect'){const x=n('x'),y=n('y'),w=n('width'),h=n('height'),rx=clamp(n('rx',n('ry')),0,w/2),ry=clamp(n('ry',rx),0,h/2);return rx&&ry?`M${x+rx} ${y} H${x+w-rx} A${rx} ${ry} 0 0 1 ${x+w} ${y+ry} V${y+h-ry} A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H${x+rx} A${rx} ${ry} 0 0 1 ${x} ${y+h-ry} V${y+ry} A${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`:`M${x} ${y} h${w} v${h} h${-w} Z`}
    if(tag==='circle'||tag==='ellipse'){const x=n('cx'),y=n('cy'),rx=n('rx',n('r')),ry=n('ry',n('r'));return `M${x-rx} ${y} A${rx} ${ry} 0 1 0 ${x+rx} ${y} A${rx} ${ry} 0 1 0 ${x-rx} ${y} Z`}
    return ''
  }
  let visits=0
  function visit(el:Element,parent:Record<string,string>,transforms:string[],opacity:number,seen:Set<Element>,depth=0){
    if(++visits>10000||depth>64)throw new Error('SVG nesting or reference limit exceeded.')
    if(seen.has(el)){warnings.add('Cyclic SVG references were skipped.');return}
    const tag=el.localName,s=style(el,parent),alpha=opacity*clamp(Number(s.opacity??1));if(s.display==='none'||s.visibility==='hidden')return
    if(['defs','style','title','desc','metadata','linearGradient','radialGradient','stop'].includes(tag))return
    if(['script','foreignObject','image','text','filter','mask','clipPath','pattern','animate','set'].includes(tag)){warnings.add(`${tag} content is not imported; convert it to plain paths in the source tool.`);return}
    if(s['clip-path']||s.mask||s.filter)warnings.add('Clipping, masks and filters are not applied; expand them to paths in the source tool.')
    const next=[...transforms,el.getAttribute('transform')??'']
    if(tag==='use'){const href=el.getAttribute('href')??el.getAttribute('xlink:href');if(!href?.startsWith('#')){warnings.add('External SVG references were skipped.');return}const target=xml.getElementById(href.slice(1));if(target)visit(target,s,[...next,`translate(${Number(el.getAttribute('x')??0)} ${Number(el.getAttribute('y')??0)})`],alpha,new Set([...seen,el]),depth+1);return}
    if(tag==='svg'||tag==='g'||tag==='a'||tag==='symbol'){if(tag==='svg'&&el!==root&&el.hasAttribute('viewBox'))warnings.add('Nested SVG viewBox scaling is not applied.');for(const child of Array.from(el.children))visit(child,s,next,alpha,new Set([...seen,el]),depth+1);return}
    const d=path(el);if(!d){warnings.add(`Unsupported or empty ${tag} element was skipped.`);return}
    if(shapes.length>=64)throw new Error('SVG exceeds the 64 object limit.')
    try{
      const local={...initialShape,...parsePath(d),smooth:0},shape:Shape={...local,...parsePath(d,next),id:id(),layerId,name:(el.getAttribute('id')??`${tag} ${shapes.length+1}`).slice(0,80),fillRule:s['fill-rule']==='evenodd'?'evenodd':'nonzero',opacity:alpha}
      for(const key of ['fill','stroke'] as const){const value=(s[key]??(key==='fill'?'#000000':'none')).replace(/currentColor/g,s.color??'#000000');const ref=value.match(/^url\(\s*['"]?#([^'"\s)]+)['"]?\s*\)$/);if(ref){shape[key+'Gradient' as 'fillGradient'|'strokeGradient']=gradient(ref[1],local,next);shape[key]=shape[key+'Gradient' as 'fillGradient']?.stops[0].color??'none'}else if(value==='none')shape[key]='none';else{const paint=color(value);shape[key]=paint.color;shape[key==='fill'?'fillOpacity':'strokeOpacity']=paint.opacity}}
      shape.lineCap=['butt','round','square'].includes(s['stroke-linecap'])?s['stroke-linecap'] as Shape['lineCap']:'butt';shape.lineJoin=['miter','round','bevel'].includes(s['stroke-linejoin'])?s['stroke-linejoin'] as Shape['lineJoin']:'miter';if(s['stroke-dasharray']&&s['stroke-dasharray']!=='none')warnings.add('Dashed strokes are imported as solid strokes.');if(s['vector-effect'])warnings.add('Non-scaling stroke effects are not retained.')
      shape.fillOpacity=(shape.fillOpacity??1)*clamp(Number(s['fill-opacity']??1));shape.strokeOpacity=(shape.strokeOpacity??1)*clamp(Number(s['stroke-opacity']??1))
      const m=matrix(next),sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);if((Math.abs(sx-sy)>1e-6||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-6)&&shape.stroke!=='none')warnings.add('Non-uniform stroke transforms are approximated.')
      shape.strokeWidth=Math.max(0,Number.parseFloat(s['stroke-width']??'1')*Math.sqrt(sx*sy));shapes.push(shape)
    }catch(error){throw new Error(`Could not import ${el.getAttribute('id')??tag}: ${error instanceof Error?error.message:'invalid geometry'}`)}
  }
  visit(root,{fill:'#000000',stroke:'none'},[],1,new Set())
  if(!shapes.length)throw new Error('SVG contains no supported vector shapes.')
  const bounds=box(shapes.flatMap(geometryPoints)),scale=Math.min(1,320/Math.max(bounds.w,bounds.h,1)),cx=bounds.x+bounds.w/2,cy=bounds.y+bounds.h/2
  const normalized=shapes.map(shape=>{const s=mapGeometry(shape,p=>({x:(p.x-cx)*scale,y:(p.y-cy)*scale}),p=>({x:p.x*scale,y:p.y*scale}));if(s.strokeWidth*scale>256)warnings.add('Stroke widths were limited to 256px.');return {...s,strokeWidth:Math.min(256,s.strokeWidth*scale)}})
  if(scale<1)warnings.add('Artwork was scaled down to fit the editing area.')
  if(!validDocument({...initialDocument,layers:[{id:layerId,name:'Imported',visible:true,locked:false}],shapes:normalized}))throw new Error('SVG contains unsupported values or geometry outside the supported limits.')
  return {shapes:normalized,warnings:[...warnings]}
}
