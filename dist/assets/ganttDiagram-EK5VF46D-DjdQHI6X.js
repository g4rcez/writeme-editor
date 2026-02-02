import{g as ie,s as re,q as ae,p as ne,a as ce,b as le,_ as l,c as K,d as dt,e as oe,I as L,l as kt,k as ue,j as de,y as fe,u as he}from"./percentages-BXMCSKIN-nn6dipbc.js";import{t as ke,m as me,a as ye,i as ge,b as pe,c as Rt,d as Ot,e as ve,f as Te,g as be,h as xe,j as _e,k as we,l as Ce,n as Bt,o as Nt,p as Yt,s as zt,q as qt,r as De,u as Ee,v as Se,w as Ie}from"./advancedFormat-rOszne43.js";import{l as Ae}from"./linear-DMXXPpU0.js";import"./index-DoPkHpdC.js";import"./init-Gi6I4Gst.js";import"./defaultLocale-C4B-KCzX.js";var bt=(function(){var t=l(function(w,o,u,f){for(u=u||{},f=w.length;f--;u[w[f]]=o);return u},"o"),s=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],n=[1,27],a=[1,28],m=[1,29],h=[1,30],V=[1,31],B=[1,32],N=[1,33],E=[1,34],F=[1,9],z=[1,10],P=[1,11],R=[1,12],_=[1,13],Z=[1,14],$=[1,15],tt=[1,16],et=[1,19],st=[1,20],it=[1,21],rt=[1,22],at=[1,23],y=[1,25],T=[1,35],p={trace:l(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:l(function(o,u,f,d,g,i,c){var e=i.length-1;switch(g){case 1:return i[e-1];case 2:this.$=[];break;case 3:i[e-1].push(i[e]),this.$=i[e-1];break;case 4:case 5:this.$=i[e];break;case 6:case 7:this.$=[];break;case 8:d.setWeekday("monday");break;case 9:d.setWeekday("tuesday");break;case 10:d.setWeekday("wednesday");break;case 11:d.setWeekday("thursday");break;case 12:d.setWeekday("friday");break;case 13:d.setWeekday("saturday");break;case 14:d.setWeekday("sunday");break;case 15:d.setWeekend("friday");break;case 16:d.setWeekend("saturday");break;case 17:d.setDateFormat(i[e].substr(11)),this.$=i[e].substr(11);break;case 18:d.enableInclusiveEndDates(),this.$=i[e].substr(18);break;case 19:d.TopAxis(),this.$=i[e].substr(8);break;case 20:d.setAxisFormat(i[e].substr(11)),this.$=i[e].substr(11);break;case 21:d.setTickInterval(i[e].substr(13)),this.$=i[e].substr(13);break;case 22:d.setExcludes(i[e].substr(9)),this.$=i[e].substr(9);break;case 23:d.setIncludes(i[e].substr(9)),this.$=i[e].substr(9);break;case 24:d.setTodayMarker(i[e].substr(12)),this.$=i[e].substr(12);break;case 27:d.setDiagramTitle(i[e].substr(6)),this.$=i[e].substr(6);break;case 28:this.$=i[e].trim(),d.setAccTitle(this.$);break;case 29:case 30:this.$=i[e].trim(),d.setAccDescription(this.$);break;case 31:d.addSection(i[e].substr(8)),this.$=i[e].substr(8);break;case 33:d.addTask(i[e-1],i[e]),this.$="task";break;case 34:this.$=i[e-1],d.setClickEvent(i[e-1],i[e],null);break;case 35:this.$=i[e-2],d.setClickEvent(i[e-2],i[e-1],i[e]);break;case 36:this.$=i[e-2],d.setClickEvent(i[e-2],i[e-1],null),d.setLink(i[e-2],i[e]);break;case 37:this.$=i[e-3],d.setClickEvent(i[e-3],i[e-2],i[e-1]),d.setLink(i[e-3],i[e]);break;case 38:this.$=i[e-2],d.setClickEvent(i[e-2],i[e],null),d.setLink(i[e-2],i[e-1]);break;case 39:this.$=i[e-3],d.setClickEvent(i[e-3],i[e-1],i[e]),d.setLink(i[e-3],i[e-2]);break;case 40:this.$=i[e-1],d.setLink(i[e-1],i[e]);break;case 41:case 47:this.$=i[e-1]+" "+i[e];break;case 42:case 43:case 45:this.$=i[e-2]+" "+i[e-1]+" "+i[e];break;case 44:case 46:this.$=i[e-3]+" "+i[e-2]+" "+i[e-1]+" "+i[e];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(s,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:n,14:a,15:m,16:h,17:V,18:B,19:18,20:N,21:E,22:F,23:z,24:P,25:R,26:_,27:Z,28:$,29:tt,30:et,31:st,33:it,35:rt,36:at,37:24,38:y,40:T},t(s,[2,7],{1:[2,1]}),t(s,[2,3]),{9:36,11:17,12:r,13:n,14:a,15:m,16:h,17:V,18:B,19:18,20:N,21:E,22:F,23:z,24:P,25:R,26:_,27:Z,28:$,29:tt,30:et,31:st,33:it,35:rt,36:at,37:24,38:y,40:T},t(s,[2,5]),t(s,[2,6]),t(s,[2,17]),t(s,[2,18]),t(s,[2,19]),t(s,[2,20]),t(s,[2,21]),t(s,[2,22]),t(s,[2,23]),t(s,[2,24]),t(s,[2,25]),t(s,[2,26]),t(s,[2,27]),{32:[1,37]},{34:[1,38]},t(s,[2,30]),t(s,[2,31]),t(s,[2,32]),{39:[1,39]},t(s,[2,8]),t(s,[2,9]),t(s,[2,10]),t(s,[2,11]),t(s,[2,12]),t(s,[2,13]),t(s,[2,14]),t(s,[2,15]),t(s,[2,16]),{41:[1,40],43:[1,41]},t(s,[2,4]),t(s,[2,28]),t(s,[2,29]),t(s,[2,33]),t(s,[2,34],{42:[1,42],43:[1,43]}),t(s,[2,40],{41:[1,44]}),t(s,[2,35],{43:[1,45]}),t(s,[2,36]),t(s,[2,38],{42:[1,46]}),t(s,[2,37]),t(s,[2,39])],defaultActions:{},parseError:l(function(o,u){if(u.recoverable)this.trace(o);else{var f=new Error(o);throw f.hash=u,f}},"parseError"),parse:l(function(o){var u=this,f=[0],d=[],g=[null],i=[],c=this.table,e="",C=0,b=0,x=2,A=1,D=i.slice.call(arguments,1),S=Object.create(this.lexer),q={yy:{}};for(var gt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,gt)&&(q.yy[gt]=this.yy[gt]);S.setInput(o,q.yy),q.yy.lexer=S,q.yy.parser=this,typeof S.yylloc>"u"&&(S.yylloc={});var pt=S.yylloc;i.push(pt);var ee=S.options&&S.options.ranges;typeof q.yy.parseError=="function"?this.parseError=q.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function se(W){f.length=f.length-2*W,g.length=g.length-W,i.length=i.length-W}l(se,"popStack");function Wt(){var W;return W=d.pop()||S.lex()||A,typeof W!="number"&&(W instanceof Array&&(d=W,W=d.pop()),W=u.symbols_[W]||W),W}l(Wt,"lex");for(var M,U,O,vt,H={},ot,j,Pt,ut;;){if(U=f[f.length-1],this.defaultActions[U]?O=this.defaultActions[U]:((M===null||typeof M>"u")&&(M=Wt()),O=c[U]&&c[U][M]),typeof O>"u"||!O.length||!O[0]){var Tt="";ut=[];for(ot in c[U])this.terminals_[ot]&&ot>x&&ut.push("'"+this.terminals_[ot]+"'");S.showPosition?Tt="Parse error on line "+(C+1)+`:
`+S.showPosition()+`
Expecting `+ut.join(", ")+", got '"+(this.terminals_[M]||M)+"'":Tt="Parse error on line "+(C+1)+": Unexpected "+(M==A?"end of input":"'"+(this.terminals_[M]||M)+"'"),this.parseError(Tt,{text:S.match,token:this.terminals_[M]||M,line:S.yylineno,loc:pt,expected:ut})}if(O[0]instanceof Array&&O.length>1)throw new Error("Parse Error: multiple actions possible at state: "+U+", token: "+M);switch(O[0]){case 1:f.push(M),g.push(S.yytext),i.push(S.yylloc),f.push(O[1]),M=null,b=S.yyleng,e=S.yytext,C=S.yylineno,pt=S.yylloc;break;case 2:if(j=this.productions_[O[1]][1],H.$=g[g.length-j],H._$={first_line:i[i.length-(j||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(j||1)].first_column,last_column:i[i.length-1].last_column},ee&&(H._$.range=[i[i.length-(j||1)].range[0],i[i.length-1].range[1]]),vt=this.performAction.apply(H,[e,b,C,q.yy,O[1],g,i].concat(D)),typeof vt<"u")return vt;j&&(f=f.slice(0,-1*j*2),g=g.slice(0,-1*j),i=i.slice(0,-1*j)),f.push(this.productions_[O[1]][0]),g.push(H.$),i.push(H._$),Pt=c[f[f.length-2]][f[f.length-1]],f.push(Pt);break;case 3:return!0}}return!0},"parse")},v=(function(){var w={EOF:1,parseError:l(function(u,f){if(this.yy.parser)this.yy.parser.parseError(u,f);else throw new Error(u)},"parseError"),setInput:l(function(o,u){return this.yy=u||this.yy||{},this._input=o,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:l(function(){var o=this._input[0];this.yytext+=o,this.yyleng++,this.offset++,this.match+=o,this.matched+=o;var u=o.match(/(?:\r\n?|\n).*/g);return u?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),o},"input"),unput:l(function(o){var u=o.length,f=o.split(/(?:\r\n?|\n)/g);this._input=o+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-u),this.offset-=u;var d=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var g=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===d.length?this.yylloc.first_column:0)+d[d.length-f.length].length-f[0].length:this.yylloc.first_column-u},this.options.ranges&&(this.yylloc.range=[g[0],g[0]+this.yyleng-u]),this.yyleng=this.yytext.length,this},"unput"),more:l(function(){return this._more=!0,this},"more"),reject:l(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:l(function(o){this.unput(this.match.slice(o))},"less"),pastInput:l(function(){var o=this.matched.substr(0,this.matched.length-this.match.length);return(o.length>20?"...":"")+o.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:l(function(){var o=this.match;return o.length<20&&(o+=this._input.substr(0,20-o.length)),(o.substr(0,20)+(o.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:l(function(){var o=this.pastInput(),u=new Array(o.length+1).join("-");return o+this.upcomingInput()+`
`+u+"^"},"showPosition"),test_match:l(function(o,u){var f,d,g;if(this.options.backtrack_lexer&&(g={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(g.yylloc.range=this.yylloc.range.slice(0))),d=o[0].match(/(?:\r\n?|\n).*/g),d&&(this.yylineno+=d.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:d?d[d.length-1].length-d[d.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+o[0].length},this.yytext+=o[0],this.match+=o[0],this.matches=o,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(o[0].length),this.matched+=o[0],f=this.performAction.call(this,this.yy,this,u,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var i in g)this[i]=g[i];return!1}return!1},"test_match"),next:l(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var o,u,f,d;this._more||(this.yytext="",this.match="");for(var g=this._currentRules(),i=0;i<g.length;i++)if(f=this._input.match(this.rules[g[i]]),f&&(!u||f[0].length>u[0].length)){if(u=f,d=i,this.options.backtrack_lexer){if(o=this.test_match(f,g[i]),o!==!1)return o;if(this._backtrack){u=!1;continue}else return!1}else if(!this.options.flex)break}return u?(o=this.test_match(u,g[d]),o!==!1?o:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:l(function(){var u=this.next();return u||this.lex()},"lex"),begin:l(function(u){this.conditionStack.push(u)},"begin"),popState:l(function(){var u=this.conditionStack.length-1;return u>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:l(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:l(function(u){return u=this.conditionStack.length-1-Math.abs(u||0),u>=0?this.conditionStack[u]:"INITIAL"},"topState"),pushState:l(function(u){this.begin(u)},"pushState"),stateStackSize:l(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:l(function(u,f,d,g){switch(d){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return w})();p.lexer=v;function k(){this.yy={}}return l(k,"Parser"),k.prototype=p,p.Parser=k,new k})();bt.parser=bt;var Fe=bt;L.extend(Ee);L.extend(Se);L.extend(Ie);var jt={friday:5,saturday:6},Y="",Ct="",Dt=void 0,Et="",nt=[],ct=[],St=new Map,It=[],mt=[],Q="",At="",Xt=["active","done","crit","milestone","vert"],Ft=[],lt=!1,Lt=!1,Mt="sunday",yt="saturday",xt=0,Le=l(function(){It=[],mt=[],Q="",Ft=[],ft=0,wt=void 0,ht=void 0,I=[],Y="",Ct="",At="",Dt=void 0,Et="",nt=[],ct=[],lt=!1,Lt=!1,xt=0,St=new Map,fe(),Mt="sunday",yt="saturday"},"clear"),Me=l(function(t){Ct=t},"setAxisFormat"),Ve=l(function(){return Ct},"getAxisFormat"),We=l(function(t){Dt=t},"setTickInterval"),Pe=l(function(){return Dt},"getTickInterval"),Re=l(function(t){Et=t},"setTodayMarker"),Oe=l(function(){return Et},"getTodayMarker"),Be=l(function(t){Y=t},"setDateFormat"),Ne=l(function(){lt=!0},"enableInclusiveEndDates"),Ye=l(function(){return lt},"endDatesAreInclusive"),ze=l(function(){Lt=!0},"enableTopAxis"),qe=l(function(){return Lt},"topAxisEnabled"),je=l(function(t){At=t},"setDisplayMode"),Ge=l(function(){return At},"getDisplayMode"),Ue=l(function(){return Y},"getDateFormat"),Xe=l(function(t){nt=t.toLowerCase().split(/[\s,]+/)},"setIncludes"),He=l(function(){return nt},"getIncludes"),Ke=l(function(t){ct=t.toLowerCase().split(/[\s,]+/)},"setExcludes"),Je=l(function(){return ct},"getExcludes"),Qe=l(function(){return St},"getLinks"),Ze=l(function(t){Q=t,It.push(t)},"addSection"),$e=l(function(){return It},"getSections"),ts=l(function(){let t=Gt();const s=10;let r=0;for(;!t&&r<s;)t=Gt(),r++;return mt=I,mt},"getTasks"),Ht=l(function(t,s,r,n){return n.includes(t.format(s.trim()))?!1:r.includes("weekends")&&(t.isoWeekday()===jt[yt]||t.isoWeekday()===jt[yt]+1)||r.includes(t.format("dddd").toLowerCase())?!0:r.includes(t.format(s.trim()))},"isInvalidDate"),es=l(function(t){Mt=t},"setWeekday"),ss=l(function(){return Mt},"getWeekday"),is=l(function(t){yt=t},"setWeekend"),Kt=l(function(t,s,r,n){if(!r.length||t.manualEndTime)return;let a;t.startTime instanceof Date?a=L(t.startTime):a=L(t.startTime,s,!0),a=a.add(1,"d");let m;t.endTime instanceof Date?m=L(t.endTime):m=L(t.endTime,s,!0);const[h,V]=rs(a,m,s,r,n);t.endTime=h.toDate(),t.renderEndTime=V},"checkTaskDates"),rs=l(function(t,s,r,n,a){let m=!1,h=null;for(;t<=s;)m||(h=s.toDate()),m=Ht(t,r,n,a),m&&(s=s.add(1,"d")),t=t.add(1,"d");return[s,h]},"fixTaskDates"),_t=l(function(t,s,r){r=r.trim();const a=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(a!==null){let h=null;for(const B of a.groups.ids.split(" ")){let N=X(B);N!==void 0&&(!h||N.endTime>h.endTime)&&(h=N)}if(h)return h.endTime;const V=new Date;return V.setHours(0,0,0,0),V}let m=L(r,s.trim(),!0);if(m.isValid())return m.toDate();{kt.debug("Invalid date:"+r),kt.debug("With date format:"+s.trim());const h=new Date(r);if(h===void 0||isNaN(h.getTime())||h.getFullYear()<-1e4||h.getFullYear()>1e4)throw new Error("Invalid date:"+r);return h}},"getStartDate"),Jt=l(function(t){const s=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return s!==null?[Number.parseFloat(s[1]),s[2]]:[NaN,"ms"]},"parseDuration"),Qt=l(function(t,s,r,n=!1){r=r.trim();const m=/^until\s+(?<ids>[\d\w- ]+)/.exec(r);if(m!==null){let E=null;for(const z of m.groups.ids.split(" ")){let P=X(z);P!==void 0&&(!E||P.startTime<E.startTime)&&(E=P)}if(E)return E.startTime;const F=new Date;return F.setHours(0,0,0,0),F}let h=L(r,s.trim(),!0);if(h.isValid())return n&&(h=h.add(1,"d")),h.toDate();let V=L(t);const[B,N]=Jt(r);if(!Number.isNaN(B)){const E=V.add(B,N);E.isValid()&&(V=E)}return V.toDate()},"getEndDate"),ft=0,J=l(function(t){return t===void 0?(ft=ft+1,"task"+ft):t},"parseId"),as=l(function(t,s){let r;s.substr(0,1)===":"?r=s.substr(1,s.length):r=s;const n=r.split(","),a={};Vt(n,a,Xt);for(let h=0;h<n.length;h++)n[h]=n[h].trim();let m="";switch(n.length){case 1:a.id=J(),a.startTime=t.endTime,m=n[0];break;case 2:a.id=J(),a.startTime=_t(void 0,Y,n[0]),m=n[1];break;case 3:a.id=J(n[0]),a.startTime=_t(void 0,Y,n[1]),m=n[2];break}return m&&(a.endTime=Qt(a.startTime,Y,m,lt),a.manualEndTime=L(m,"YYYY-MM-DD",!0).isValid(),Kt(a,Y,ct,nt)),a},"compileData"),ns=l(function(t,s){let r;s.substr(0,1)===":"?r=s.substr(1,s.length):r=s;const n=r.split(","),a={};Vt(n,a,Xt);for(let m=0;m<n.length;m++)n[m]=n[m].trim();switch(n.length){case 1:a.id=J(),a.startTime={type:"prevTaskEnd",id:t},a.endTime={data:n[0]};break;case 2:a.id=J(),a.startTime={type:"getStartDate",startData:n[0]},a.endTime={data:n[1]};break;case 3:a.id=J(n[0]),a.startTime={type:"getStartDate",startData:n[1]},a.endTime={data:n[2]};break}return a},"parseData"),wt,ht,I=[],Zt={},cs=l(function(t,s){const r={section:Q,type:Q,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:s},task:t,classes:[]},n=ns(ht,s);r.raw.startTime=n.startTime,r.raw.endTime=n.endTime,r.id=n.id,r.prevTaskId=ht,r.active=n.active,r.done=n.done,r.crit=n.crit,r.milestone=n.milestone,r.vert=n.vert,r.order=xt,xt++;const a=I.push(r);ht=r.id,Zt[r.id]=a-1},"addTask"),X=l(function(t){const s=Zt[t];return I[s]},"findTaskById"),ls=l(function(t,s){const r={section:Q,type:Q,description:t,task:t,classes:[]},n=as(wt,s);r.startTime=n.startTime,r.endTime=n.endTime,r.id=n.id,r.active=n.active,r.done=n.done,r.crit=n.crit,r.milestone=n.milestone,r.vert=n.vert,wt=r,mt.push(r)},"addTaskOrg"),Gt=l(function(){const t=l(function(r){const n=I[r];let a="";switch(I[r].raw.startTime.type){case"prevTaskEnd":{const m=X(n.prevTaskId);n.startTime=m.endTime;break}case"getStartDate":a=_t(void 0,Y,I[r].raw.startTime.startData),a&&(I[r].startTime=a);break}return I[r].startTime&&(I[r].endTime=Qt(I[r].startTime,Y,I[r].raw.endTime.data,lt),I[r].endTime&&(I[r].processed=!0,I[r].manualEndTime=L(I[r].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),Kt(I[r],Y,ct,nt))),I[r].processed},"compileTask");let s=!0;for(const[r,n]of I.entries())t(r),s=s&&n.processed;return s},"compileTasks"),os=l(function(t,s){let r=s;K().securityLevel!=="loose"&&(r=de.sanitizeUrl(s)),t.split(",").forEach(function(n){X(n)!==void 0&&(te(n,()=>{window.open(r,"_self")}),St.set(n,r))}),$t(t,"clickable")},"setLink"),$t=l(function(t,s){t.split(",").forEach(function(r){let n=X(r);n!==void 0&&n.classes.push(s)})},"setClass"),us=l(function(t,s,r){if(K().securityLevel!=="loose"||s===void 0)return;let n=[];if(typeof r=="string"){n=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let m=0;m<n.length;m++){let h=n[m].trim();h.startsWith('"')&&h.endsWith('"')&&(h=h.substr(1,h.length-2)),n[m]=h}}n.length===0&&n.push(t),X(t)!==void 0&&te(t,()=>{he.runFunc(s,...n)})},"setClickFun"),te=l(function(t,s){Ft.push(function(){const r=document.querySelector(`[id="${t}"]`);r!==null&&r.addEventListener("click",function(){s()})},function(){const r=document.querySelector(`[id="${t}-text"]`);r!==null&&r.addEventListener("click",function(){s()})})},"pushFun"),ds=l(function(t,s,r){t.split(",").forEach(function(n){us(n,s,r)}),$t(t,"clickable")},"setClickEvent"),fs=l(function(t){Ft.forEach(function(s){s(t)})},"bindFunctions"),hs={getConfig:l(()=>K().gantt,"getConfig"),clear:Le,setDateFormat:Be,getDateFormat:Ue,enableInclusiveEndDates:Ne,endDatesAreInclusive:Ye,enableTopAxis:ze,topAxisEnabled:qe,setAxisFormat:Me,getAxisFormat:Ve,setTickInterval:We,getTickInterval:Pe,setTodayMarker:Re,getTodayMarker:Oe,setAccTitle:le,getAccTitle:ce,setDiagramTitle:ne,getDiagramTitle:ae,setDisplayMode:je,getDisplayMode:Ge,setAccDescription:re,getAccDescription:ie,addSection:Ze,getSections:$e,getTasks:ts,addTask:cs,findTaskById:X,addTaskOrg:ls,setIncludes:Xe,getIncludes:He,setExcludes:Ke,getExcludes:Je,setClickEvent:ds,setLink:os,getLinks:Qe,bindFunctions:fs,parseDuration:Jt,isInvalidDate:Ht,setWeekday:es,getWeekday:ss,setWeekend:is};function Vt(t,s,r){let n=!0;for(;n;)n=!1,r.forEach(function(a){const m="^\\s*"+a+"\\s*$",h=new RegExp(m);t[0].match(h)&&(s[a]=!0,t.shift(1),n=!0)})}l(Vt,"getTaskTags");var ks=l(function(){kt.debug("Something is calling, setConf, remove the call")},"setConf"),Ut={monday:Ce,tuesday:we,wednesday:_e,thursday:xe,friday:be,saturday:Te,sunday:ve},ms=l((t,s)=>{let r=[...t].map(()=>-1/0),n=[...t].sort((m,h)=>m.startTime-h.startTime||m.order-h.order),a=0;for(const m of n)for(let h=0;h<r.length;h++)if(m.startTime>=r[h]){r[h]=m.endTime,m.order=h+s,h>a&&(a=h);break}return a},"getMaxIntersections"),G,ys=l(function(t,s,r,n){const a=K().gantt,m=K().securityLevel;let h;m==="sandbox"&&(h=dt("#i"+s));const V=m==="sandbox"?dt(h.nodes()[0].contentDocument.body):dt("body"),B=m==="sandbox"?h.nodes()[0].contentDocument:document,N=B.getElementById(s);G=N.parentElement.offsetWidth,G===void 0&&(G=1200),a.useWidth!==void 0&&(G=a.useWidth);const E=n.db.getTasks();let F=[];for(const y of E)F.push(y.type);F=at(F);const z={};let P=2*a.topPadding;if(n.db.getDisplayMode()==="compact"||a.displayMode==="compact"){const y={};for(const p of E)y[p.section]===void 0?y[p.section]=[p]:y[p.section].push(p);let T=0;for(const p of Object.keys(y)){const v=ms(y[p],T)+1;T+=v,P+=v*(a.barHeight+a.barGap),z[p]=v}}else{P+=E.length*(a.barHeight+a.barGap);for(const y of F)z[y]=E.filter(T=>T.type===y).length}N.setAttribute("viewBox","0 0 "+G+" "+P);const R=V.select(`[id="${s}"]`),_=ke().domain([me(E,function(y){return y.startTime}),ye(E,function(y){return y.endTime})]).rangeRound([0,G-a.leftPadding-a.rightPadding]);function Z(y,T){const p=y.startTime,v=T.startTime;let k=0;return p>v?k=1:p<v&&(k=-1),k}l(Z,"taskCompare"),E.sort(Z),$(E,G,P),oe(R,P,G,a.useMaxWidth),R.append("text").text(n.db.getDiagramTitle()).attr("x",G/2).attr("y",a.titleTopMargin).attr("class","titleText");function $(y,T,p){const v=a.barHeight,k=v+a.barGap,w=a.topPadding,o=a.leftPadding,u=Ae().domain([0,F.length]).range(["#00B9FA","#F95002"]).interpolate(ge);et(k,w,o,T,p,y,n.db.getExcludes(),n.db.getIncludes()),st(o,w,T,p),tt(y,k,w,o,v,u,T),it(k,w),rt(o,w,T,p)}l($,"makeGantt");function tt(y,T,p,v,k,w,o){y.sort((c,e)=>c.vert===e.vert?0:c.vert?1:-1);const f=[...new Set(y.map(c=>c.order))].map(c=>y.find(e=>e.order===c));R.append("g").selectAll("rect").data(f).enter().append("rect").attr("x",0).attr("y",function(c,e){return e=c.order,e*T+p-2}).attr("width",function(){return o-a.rightPadding/2}).attr("height",T).attr("class",function(c){for(const[e,C]of F.entries())if(c.type===C)return"section section"+e%a.numberSectionStyles;return"section section0"}).enter();const d=R.append("g").selectAll("rect").data(y).enter(),g=n.db.getLinks();if(d.append("rect").attr("id",function(c){return c.id}).attr("rx",3).attr("ry",3).attr("x",function(c){return c.milestone?_(c.startTime)+v+.5*(_(c.endTime)-_(c.startTime))-.5*k:_(c.startTime)+v}).attr("y",function(c,e){return e=c.order,c.vert?a.gridLineStartPadding:e*T+p}).attr("width",function(c){return c.milestone?k:c.vert?.08*k:_(c.renderEndTime||c.endTime)-_(c.startTime)}).attr("height",function(c){return c.vert?E.length*(a.barHeight+a.barGap)+a.barHeight*2:k}).attr("transform-origin",function(c,e){return e=c.order,(_(c.startTime)+v+.5*(_(c.endTime)-_(c.startTime))).toString()+"px "+(e*T+p+.5*k).toString()+"px"}).attr("class",function(c){const e="task";let C="";c.classes.length>0&&(C=c.classes.join(" "));let b=0;for(const[A,D]of F.entries())c.type===D&&(b=A%a.numberSectionStyles);let x="";return c.active?c.crit?x+=" activeCrit":x=" active":c.done?c.crit?x=" doneCrit":x=" done":c.crit&&(x+=" crit"),x.length===0&&(x=" task"),c.milestone&&(x=" milestone "+x),c.vert&&(x=" vert "+x),x+=b,x+=" "+C,e+x}),d.append("text").attr("id",function(c){return c.id+"-text"}).text(function(c){return c.task}).attr("font-size",a.fontSize).attr("x",function(c){let e=_(c.startTime),C=_(c.renderEndTime||c.endTime);if(c.milestone&&(e+=.5*(_(c.endTime)-_(c.startTime))-.5*k,C=e+k),c.vert)return _(c.startTime)+v;const b=this.getBBox().width;return b>C-e?C+b+1.5*a.leftPadding>o?e+v-5:C+v+5:(C-e)/2+e+v}).attr("y",function(c,e){return c.vert?a.gridLineStartPadding+E.length*(a.barHeight+a.barGap)+60:(e=c.order,e*T+a.barHeight/2+(a.fontSize/2-2)+p)}).attr("text-height",k).attr("class",function(c){const e=_(c.startTime);let C=_(c.endTime);c.milestone&&(C=e+k);const b=this.getBBox().width;let x="";c.classes.length>0&&(x=c.classes.join(" "));let A=0;for(const[S,q]of F.entries())c.type===q&&(A=S%a.numberSectionStyles);let D="";return c.active&&(c.crit?D="activeCritText"+A:D="activeText"+A),c.done?c.crit?D=D+" doneCritText"+A:D=D+" doneText"+A:c.crit&&(D=D+" critText"+A),c.milestone&&(D+=" milestoneText"),c.vert&&(D+=" vertText"),b>C-e?C+b+1.5*a.leftPadding>o?x+" taskTextOutsideLeft taskTextOutside"+A+" "+D:x+" taskTextOutsideRight taskTextOutside"+A+" "+D+" width-"+b:x+" taskText taskText"+A+" "+D+" width-"+b}),K().securityLevel==="sandbox"){let c;c=dt("#i"+s);const e=c.nodes()[0].contentDocument;d.filter(function(C){return g.has(C.id)}).each(function(C){var b=e.querySelector("#"+C.id),x=e.querySelector("#"+C.id+"-text");const A=b.parentNode;var D=e.createElement("a");D.setAttribute("xlink:href",g.get(C.id)),D.setAttribute("target","_top"),A.appendChild(D),D.appendChild(b),D.appendChild(x)})}}l(tt,"drawRects");function et(y,T,p,v,k,w,o,u){if(o.length===0&&u.length===0)return;let f,d;for(const{startTime:b,endTime:x}of w)(f===void 0||b<f)&&(f=b),(d===void 0||x>d)&&(d=x);if(!f||!d)return;if(L(d).diff(L(f),"year")>5){kt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const g=n.db.getDateFormat(),i=[];let c=null,e=L(f);for(;e.valueOf()<=d;)n.db.isInvalidDate(e,g,o,u)?c?c.end=e:c={start:e,end:e}:c&&(i.push(c),c=null),e=e.add(1,"d");R.append("g").selectAll("rect").data(i).enter().append("rect").attr("id",function(b){return"exclude-"+b.start.format("YYYY-MM-DD")}).attr("x",function(b){return _(b.start)+p}).attr("y",a.gridLineStartPadding).attr("width",function(b){const x=b.end.add(1,"day");return _(x)-_(b.start)}).attr("height",k-T-a.gridLineStartPadding).attr("transform-origin",function(b,x){return(_(b.start)+p+.5*(_(b.end)-_(b.start))).toString()+"px "+(x*y+.5*k).toString()+"px"}).attr("class","exclude-range")}l(et,"drawExcludeDays");function st(y,T,p,v){let k=pe(_).tickSize(-v+T+a.gridLineStartPadding).tickFormat(Rt(n.db.getAxisFormat()||a.axisFormat||"%Y-%m-%d"));const o=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(n.db.getTickInterval()||a.tickInterval);if(o!==null){const u=o[1],f=o[2],d=n.db.getWeekday()||a.weekday;switch(f){case"millisecond":k.ticks(qt.every(u));break;case"second":k.ticks(zt.every(u));break;case"minute":k.ticks(Yt.every(u));break;case"hour":k.ticks(Nt.every(u));break;case"day":k.ticks(Bt.every(u));break;case"week":k.ticks(Ut[d].every(u));break;case"month":k.ticks(Ot.every(u));break}}if(R.append("g").attr("class","grid").attr("transform","translate("+y+", "+(v-50)+")").call(k).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),n.db.topAxisEnabled()||a.topAxis){let u=De(_).tickSize(-v+T+a.gridLineStartPadding).tickFormat(Rt(n.db.getAxisFormat()||a.axisFormat||"%Y-%m-%d"));if(o!==null){const f=o[1],d=o[2],g=n.db.getWeekday()||a.weekday;switch(d){case"millisecond":u.ticks(qt.every(f));break;case"second":u.ticks(zt.every(f));break;case"minute":u.ticks(Yt.every(f));break;case"hour":u.ticks(Nt.every(f));break;case"day":u.ticks(Bt.every(f));break;case"week":u.ticks(Ut[g].every(f));break;case"month":u.ticks(Ot.every(f));break}}R.append("g").attr("class","grid").attr("transform","translate("+y+", "+T+")").call(u).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}l(st,"makeGrid");function it(y,T){let p=0;const v=Object.keys(z).map(k=>[k,z[k]]);R.append("g").selectAll("text").data(v).enter().append(function(k){const w=k[0].split(ue.lineBreakRegex),o=-(w.length-1)/2,u=B.createElementNS("http://www.w3.org/2000/svg","text");u.setAttribute("dy",o+"em");for(const[f,d]of w.entries()){const g=B.createElementNS("http://www.w3.org/2000/svg","tspan");g.setAttribute("alignment-baseline","central"),g.setAttribute("x","10"),f>0&&g.setAttribute("dy","1em"),g.textContent=d,u.appendChild(g)}return u}).attr("x",10).attr("y",function(k,w){if(w>0)for(let o=0;o<w;o++)return p+=v[w-1][1],k[1]*y/2+p*y+T;else return k[1]*y/2+T}).attr("font-size",a.sectionFontSize).attr("class",function(k){for(const[w,o]of F.entries())if(k[0]===o)return"sectionTitle sectionTitle"+w%a.numberSectionStyles;return"sectionTitle"})}l(it,"vertLabels");function rt(y,T,p,v){const k=n.db.getTodayMarker();if(k==="off")return;const w=R.append("g").attr("class","today"),o=new Date,u=w.append("line");u.attr("x1",_(o)+y).attr("x2",_(o)+y).attr("y1",a.titleTopMargin).attr("y2",v-a.titleTopMargin).attr("class","today"),k!==""&&u.attr("style",k.replace(/,/g,";"))}l(rt,"drawToday");function at(y){const T={},p=[];for(let v=0,k=y.length;v<k;++v)Object.prototype.hasOwnProperty.call(T,y[v])||(T[y[v]]=!0,p.push(y[v]));return p}l(at,"checkUnique")},"draw"),gs={setConf:ks,draw:ys},ps=l(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles"),vs=ps,Ds={parser:Fe,db:hs,renderer:gs,styles:vs};export{Ds as diagram};
//# sourceMappingURL=ganttDiagram-EK5VF46D-DjdQHI6X.js.map
