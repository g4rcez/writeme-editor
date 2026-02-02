import{p as N}from"./chunk-353BL4L5-B7qGBdGR.js";import{g as B,s as U,a as q,b as K,q as V,p as Z,_ as i,l as D,c as j,D as H,K as J,M as Q,e as X,y as Y,F as ee}from"./percentages-BXMCSKIN-nn6dipbc.js";import{p as te}from"./treemap-75Q7IDZK-BNRehxmi.js";import{a as z}from"./arc-CZ7GIucb.js";import{o as ae}from"./ordinal-Cboi1Yqb.js";import{p as re}from"./pie-gEzwiw1B.js";import"./index-DoPkHpdC.js";import"./_baseUniq-BcMOEDXM.js";import"./_basePickBy-B2wfy3UX.js";import"./has-IKbx_zTK.js";import"./clone-DoxobkwM.js";import"./init-Gi6I4Gst.js";var ie=ee.pie,C={sections:new Map,showData:!1},f=C.sections,w=C.showData,oe=structuredClone(ie),se=i(()=>structuredClone(oe),"getConfig"),ne=i(()=>{f=new Map,w=C.showData,Y()},"clear"),le=i(({label:e,value:t})=>{f.has(e)||(f.set(e,t),D.debug(`added new section: ${e}, with value: ${t}`))},"addSection"),ce=i(()=>f,"getSections"),pe=i(e=>{w=e},"setShowData"),de=i(()=>w,"getShowData"),F={getConfig:se,clear:ne,setDiagramTitle:Z,getDiagramTitle:V,setAccTitle:K,getAccTitle:q,setAccDescription:U,getAccDescription:B,addSection:le,getSections:ce,setShowData:pe,getShowData:de},ge=i((e,t)=>{N(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},"populateDb"),me={parse:i(async e=>{const t=await te("pie",e);D.debug(t),ge(t,F)},"parse")},ue=i(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),fe=ue,he=i(e=>{const t=[...e.entries()].map(o=>({label:o[0],value:o[1]})).sort((o,n)=>n.value-o.value);return re().value(o=>o.value)(t)},"createPieArcs"),Se=i((e,t,G,o)=>{D.debug(`rendering pie chart
`+e);const n=o.db,y=j(),$=H(n.getConfig(),y.pie),T=40,s=18,d=4,c=450,h=c,S=J(t),l=S.append("g");l.attr("transform","translate("+h/2+","+c/2+")");const{themeVariables:a}=y;let[A]=Q(a.pieOuterStrokeWidth);A??=2;const _=$.textPosition,g=Math.min(h,c)/2-T,M=z().innerRadius(0).outerRadius(g),W=z().innerRadius(g*_).outerRadius(g*_);l.append("circle").attr("cx",0).attr("cy",0).attr("r",g+A/2).attr("class","pieOuterCircle");const b=n.getSections(),v=he(b),O=[a.pie1,a.pie2,a.pie3,a.pie4,a.pie5,a.pie6,a.pie7,a.pie8,a.pie9,a.pie10,a.pie11,a.pie12],p=ae(O);l.selectAll("mySlices").data(v).enter().append("path").attr("d",M).attr("fill",r=>p(r.data.label)).attr("class","pieCircle");let E=0;b.forEach(r=>{E+=r}),l.selectAll("mySlices").data(v).enter().append("text").text(r=>(r.data.value/E*100).toFixed(0)+"%").attr("transform",r=>"translate("+W.centroid(r)+")").style("text-anchor","middle").attr("class","slice"),l.append("text").text(n.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");const x=l.selectAll(".legend").data(p.domain()).enter().append("g").attr("class","legend").attr("transform",(r,m)=>{const u=s+d,R=u*p.domain().length/2,I=12*s,L=m*u-R;return"translate("+I+","+L+")"});x.append("rect").attr("width",s).attr("height",s).style("fill",p).style("stroke",p),x.data(v).append("text").attr("x",s+d).attr("y",s-d).text(r=>{const{label:m,value:u}=r.data;return n.getShowData()?`${m} [${u}]`:m});const P=Math.max(...x.selectAll("text").nodes().map(r=>r?.getBoundingClientRect().width??0)),k=h+T+s+d+P;S.attr("viewBox",`0 0 ${k} ${c}`),X(S,c,k,$.useMaxWidth)},"draw"),ve={draw:Se},ze={parser:me,db:F,renderer:ve,styles:fe};export{ze as diagram};
//# sourceMappingURL=pieDiagram-NIOCPIFQ-t4QfGTup.js.map
