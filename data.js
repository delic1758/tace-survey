const SURVEY={"schema":"tace-pages-v1.9-live","version":"v1.9","participant_count":50,"per_participant":10,"document_count":100,"per_document":5,"questions":[{"text":"Q1. 이 설명은 필요한 내용을 충분히 포함하고 있었다.","rev":false},{"text":"Q2. 이 설명은 간결하고 이해하기 쉬웠다.","rev":false},{"text":"Q3. 이 설명은 나를 배려하고 있다는 느낌을 주었다.","rev":false},{"text":"Q4. 전반적으로 이 설명에 만족한다.","rev":false}],"scale":["전혀 그렇지 않다","그렇지 않다","보통이다","그렇다","매우 그렇다"]};
const SurveyMath={
 mean(a){return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;},
 quantile(a,p){if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),h=(s.length-1)*p,i=Math.floor(h);return s[i]+(s[Math.min(i+1,s.length-1)]-s[i])*(h-i);},
 stats(values){const a=values.filter(v=>typeof v==='number'&&Number.isFinite(v)),m=this.mean(a);return{n:a.length,mean:m,sd:a.length>1?Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)):null,median:this.quantile(a,.5),p25:this.quantile(a,.25),p75:this.quantile(a,.75),min:a.length?Math.min(...a):null,max:a.length?Math.max(...a):null};},
 csv(rows){return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');},
 summary(data){
  const r=data.responses,byParticipant={},byDocument={};
  for(const x of r){if(byParticipant[x.participant_id]==null){byParticipant[x.participant_id]=[];}byParticipant[x.participant_id].push(x);byDocument[x.case_code]=(byDocument[x.case_code]||0)+1;}
  const seen=new Set(),people=data.participants.filter(p=>{if(p.eligible_for_statistics===false||(p.eligible_for_statistics!==true&&p.consent!==true)||seen.has(p.participant_id))return false;seen.add(p.participant_id);return true;});
  const documents=[...new Set(data.assignments.flatMap(a=>a.documents.map(d=>d.case_code)))].sort();
  const questions=[1,2,3,4].map(i=>{const a=r.map(x=>x['Q'+i]).filter(v=>Number.isInteger(v)&&v>=1&&v<=5),s=this.stats(a);return{...s,counts:[1,2,3,4,5].map(v=>a.filter(x=>x===v).length),positive:a.filter(x=>x>=4).length};});
  const age=this.stats(people.map(p=>p.age).filter(x=>Number.isInteger(x)&&x>=18&&x<=120));
  const genders=['여성','남성','기타','응답 안 함'].map(g=>({gender:g,n:people.filter(p=>(p.gender||'응답 안 함')===g).length}));
  const documentMeans=documents.map(id=>({case_code:id,n:byDocument[id]||0,q:[1,2,3,4].map(i=>this.mean(r.filter(x=>x.case_code===id).map(x=>x['Q'+i])))}));
  return{total:r.length,enrolled:people.length,finished:Object.values(byParticipant).filter(x=>x.length===10).length,byParticipant,byDocument,documents,questions,mean4:this.mean(r.map(x=>(x.Q1+x.Q2+x.Q3+x.Q4)/4)),sameScore:r.filter(x=>new Set([x.Q1,x.Q2,x.Q3,x.Q4]).size===1).length,age,ageMissing:people.length-age.n,genders,documentMeans};
 },
 report(data){
  const d=this.summary(data),header=['구분','항목','통계량','값','분모','단위·기준'],rows=[];
  const add=(g,k,m,v,n='',unit='')=>rows.push([g,k,m,v??'',n,unit]);
  add('진행','등록 참여자','명',d.enrolled,50,'참여자 중복 제외');add('진행','10건 완료 참여자','명',d.finished,50);
  add('진행','유효 평가','건',d.total,500,'참여자×문서의 최신 유효 응답');add('진행','미완료 배정','건',500-d.total,500,'0점으로 대치하지 않음');
  add('자료점검','확인 필요 기록','건',data.issues.length,'','원기록 보존, 집계는 유효 응답 기준');
  for(let i=0;i<4;i++){const s=d.questions[i],k='Q'+(i+1);add('문항',k,'응답 수',s.n,500);
   for(const [m,key] of [['평균','mean'],['표준편차','sd'],['중앙값','median'],['25백분위수','p25'],['75백분위수','p75'],['최솟값','min'],['최댓값','max']])add('문항',k,m,s[key],s.n,key==='sd'?'표본 SD, n−1; n<2는 공란':'유효 응답; 백분위수는 선형 보간');
   s.counts.forEach((n,j)=>{add('점수분포',k,(j+1)+'점 빈도',n,s.n,'건');add('점수분포',k,(j+1)+'점 비율',s.n?n/s.n*100:null,s.n,'%');});
   add('점수분포',k,'4~5점 비율',s.n?s.positive/s.n*100:null,s.n,'%');
  }
  add('참여자','나이','응답 수',d.age.n,d.enrolled,'명; 참여자당 한 번');add('참여자','나이','미응답 수',d.ageMissing,d.enrolled,'연령대에서 나이를 추정하지 않음');
  for(const [m,key] of [['평균','mean'],['표준편차','sd'],['중앙값','median'],['25백분위수','p25'],['75백분위수','p75'],['최솟값','min'],['최댓값','max']])add('참여자','나이',m,d.age[key],d.age.n,'만 나이(세)');
  d.genders.forEach(x=>{add('참여자','성별',x.gender+' 빈도',x.n,d.enrolled,'명');add('참여자','성별',x.gender+' 비율',d.enrolled?x.n/d.enrolled*100:null,d.enrolled,'% · 미응답 포함 전체 등록자 분모');});
  d.documentMeans.forEach(x=>x.q.forEach((m,i)=>add('문서별 평균',x.case_code,'Q'+(i+1),m,x.n,'문서당 목표 5명; 미완료 여부는 분모 확인')));
  add('해석','문항 통계','분석 단위','','','반복 평가의 기술통계. 500건을 독립 표본으로 간주한 신뢰구간·p값은 계산하지 않음');
  add('해석','통계 산출','결측','','','미응답을 0으로 대치하지 않음. 표시는 반올림, CSV는 계산값 유지');
  return{header,rows};
 }
};
