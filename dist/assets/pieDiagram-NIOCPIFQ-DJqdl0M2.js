import{p as N}from"./chunk-353BL4L5-CjMAMEFN.js";import{_ as i,g as B,s as U,b as H,c as K,v as V,t as Z,l as C,d as j,H as q,N as J,P as Q,f as X,A as Y,K as tt}from"./percentages-BXMCSKIN-D-98AIe3.js";import{p as et}from"./treemap-75Q7IDZK-DajLD4bI.js";import{a as z}from"./arc-B0uW4373.js";import{o as at}from"./ordinal-Cboi1Yqb.js";import{p as rt}from"./pie-CvNlpvdH.js";import"./index-tuDCk0Z6.js";import"./_baseUniq-D2am4e8z.js";import"./_basePickBy-9_FqKg8X.js";import"./has-CcIgc8kJ.js";import"./clone-DN20SPlx.js";import"./init-Gi6I4Gst.js";var it=tt.pie,D={sections:new Map,showData:!1},u=D.sections,w=D.showData,ot=structuredClone(it),st=i(()=>structuredClone(ot),"getConfig"),nt=i(()=>{u=new Map,w=D.showData,Y()},"clear"),lt=i(({label:t,value:e})=>{u.has(t)||(u.set(t,e),C.debug(`added new section: ${t}, with value: ${e}`))},"addSection"),ct=i(()=>u,"getSections"),pt=i(t=>{w=t},"setShowData"),dt=i(()=>w,"getShowData"),F={getConfig:st,clear:nt,setDiagramTitle:Z,getDiagramTitle:V,setAccTitle:K,getAccTitle:H,setAccDescription:U,getAccDescription:B,addSection:lt,getSections:ct,setShowData:pt,getShowData:dt},gt=i((t,e)=>{N(t,e),e.setShowData(t.showData),t.sections.map(e.addSection)},"populateDb"),mt={parse:i(async t=>{const e=await et("pie",t);C.debug(e),gt(e,F)},"parse")},ft=i(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),ut=ft,ht=i(t=>{const e=[...t.entries()].map(o=>({label:o[0],value:o[1]})).sort((o,n)=>n.value-o.value);return rt().value(o=>o.value)(e)},"createPieArcs"),vt=i((t,e,G,o)=>{C.debug(`rendering pie chart
`+t);const n=o.db,$=j(),y=q(n.getConfig(),$.pie),T=40,s=18,d=4,c=450,h=c,v=J(e),l=v.append("g");l.attr("transform","translate("+h/2+","+c/2+")");const{themeVariables:a}=$;let[A]=Q(a.pieOuterStrokeWidth);A??=2;const _=y.textPosition,g=Math.min(h,c)/2-T,P=z().innerRadius(0).outerRadius(g),W=z().innerRadius(g*_).outerRadius(g*_);l.append("circle").attr("cx",0).attr("cy",0).attr("r",g+A/2).attr("class","pieOuterCircle");const b=n.getSections(),S=ht(b),M=[a.pie1,a.pie2,a.pie3,a.pie4,a.pie5,a.pie6,a.pie7,a.pie8,a.pie9,a.pie10,a.pie11,a.pie12],p=at(M);l.selectAll("mySlices").data(S).enter().append("path").attr("d",P).attr("fill",r=>p(r.data.label)).attr("class","pieCircle");let E=0;b.forEach(r=>{E+=r}),l.selectAll("mySlices").data(S).enter().append("text").text(r=>(r.data.value/E*100).toFixed(0)+"%").attr("transform",r=>"translate("+W.centroid(r)+")").style("text-anchor","middle").attr("class","slice"),l.append("text").text(n.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");const x=l.selectAll(".legend").data(p.domain()).enter().append("g").attr("class","legend").attr("transform",(r,m)=>{const f=s+d,R=f*p.domain().length/2,I=12*s,L=m*f-R;return"translate("+I+","+L+")"});x.append("rect").attr("width",s).attr("height",s).style("fill",p).style("stroke",p),x.data(S).append("text").attr("x",s+d).attr("y",s-d).text(r=>{const{label:m,value:f}=r.data;return n.getShowData()?`${m} [${f}]`:m});const O=Math.max(...x.selectAll("text").nodes().map(r=>r?.getBoundingClientRect().width??0)),k=h+T+s+d+O;v.attr("viewBox",`0 0 ${k} ${c}`),X(v,c,k,y.useMaxWidth)},"draw"),St={draw:vt},zt={parser:mt,db:F,renderer:St,styles:ut};export{zt as diagram};
//# sourceMappingURL=pieDiagram-NIOCPIFQ-DJqdl0M2.js.map
