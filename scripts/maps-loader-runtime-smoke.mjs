import assert from "node:assert/strict";
import { sourceLoader, find } from "./helpers/source-runtime.mjs";

function scenario({key="synthetic-browser-key",react}={}) {
  const timers=new Map(),scripts=[];
  let nextTimer=0;
  const browser={setTimeout: callback=>{const id=++nextTimer;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id)};
  const document={createElement:()=>({onload:null,onerror:null,remove(){this.removed=true;}}),head:{appendChild:script=>scripts.push(script)}};
  const load=sourceLoader({react:react??{useEffect(){},useState:initial=>[initial,()=>{}]}},{window:browser,document,process:{env:{NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:key}}},{"src/shared/hooks/use-google-maps.ts":"\nexport { loadGoogleMaps };"});
  return {browser,timers,scripts,...load("src/shared/hooks/use-google-maps.ts")};
}
let checks=0;
async function check(name,run){await run();checks++;console.log(`PASS ${name}`);}

await check("Concurrent consumers wait for the Google ready callback, never script onload",async()=>{
  const s=scenario();let ready=false;
  const first=s.loadGoogleMaps("synthetic-browser-key");first.then(()=>{ready=true;});
  assert.equal(s.loadGoogleMaps("synthetic-browser-key"),first);assert.equal(s.scripts.length,1);
  const url=new URL(s.scripts[0].src);
  assert.equal(url.searchParams.get("loading"),"async");assert.equal(url.searchParams.get("callback"),"__cibauraMapsReady");
  s.scripts[0].onload?.();await Promise.resolve();assert.equal(ready,false);
  s.browser.google={maps:{places:{}}};s.browser.__cibauraMapsReady();await first;
  assert.equal(ready,true);assert.equal(s.timers.size,0);assert.equal(s.browser.__cibauraMapsReady,undefined);
});
await check("A callback without Places rejects and a later mount can retry",async()=>{
  const s=scenario();const failed=s.loadGoogleMaps("synthetic-browser-key");
  s.browser.__cibauraMapsReady();await assert.rejects(failed,/did not become ready/);
  assert.equal(s.scripts[0].removed,true);
  const retry=s.loadGoogleMaps("synthetic-browser-key");assert.equal(s.scripts.length,2);
  s.browser.google={maps:{places:{}}};s.browser.__cibauraMapsReady();await retry;
});
await check("Network failure and timeout clear their callback/script and remain retryable",async()=>{
  for(const failure of ["network","timeout"]){
    const s=scenario();const failed=s.loadGoogleMaps("synthetic-browser-key");
    if(failure==="network")s.scripts[0].onerror();else [...s.timers.values()][0]();
    await assert.rejects(failed,failure==="network"?/could not load/:/too long/);
    assert.equal(s.browser.__cibauraMapsReady,undefined);assert.equal(s.timers.size,0);
    const retry=s.loadGoogleMaps("synthetic-browser-key");assert.equal(s.scripts.length,2);
    s.browser.google={maps:{places:{}}};s.browser.__cibauraMapsReady();await retry;
  }
});
await check("Unmounted hook consumers ignore a delayed ready callback",async()=>{
  const effects=[],updates=[];
  const s=scenario({react:{useEffect:effect=>effects.push(effect),useState:initial=>[initial,value=>updates.push(value)]}});
  s.useGoogleMaps();const cleanup=effects[0]();cleanup();
  s.browser.google={maps:{places:{}}};s.browser.__cibauraMapsReady();
  await Promise.resolve();await Promise.resolve();assert.deepEqual(updates,[]);
});
await check("Missing key is reported as configuration availability without loading a script",()=>{
  const effects=[],updates=[];
  const s=scenario({key:"",react:{useEffect:effect=>effects.push(effect),useState:initial=>[initial,value=>updates.push(value)]}});
  s.useGoogleMaps();effects[0]();assert.equal(s.scripts.length,0);
  assert.match(updates[0],/not available in this version/);
});

await check("Actual address component includes airport establishments and keeps location callbacks safe",()=>{
  const refs=[],states=[];let refIndex=0,stateIndex=0,effect,place,changed,options,removed=false;
  const first=[],second=[],cleared=[];
  const google={maps:{places:{Autocomplete:class{
    constructor(_input,initOptions){options=initOptions;}
    addListener(_event,callback){changed=callback;return{remove(){removed=true;}};}
    getPlace(){return place;}
  }}}};
  const load=sourceLoader({
    react:{useRef:initial=>{const i=refIndex++;return refs[i]??={current:i===0?{}:initial};},useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=value;}];},useEffect:callback=>{effect=callback;}},
    "@/shared/hooks/use-google-maps":{useGoogleMaps:()=>({loaded:true,error:null})},
  },{window:{google},google});
  const component=load("src/shared/components/address-autocomplete.tsx").AddressAutocomplete;
  const render=props=>{refIndex=0;stateIndex=0;return component(props);};
  const firstProps={onSelect:value=>first.push(value),onClear:()=>cleared.push(true)};
  render(firstProps);const cleanup=effect();
  assert.equal(Object.hasOwn(options,"types"),false);
  assert.ok(options.fields.includes("geometry"));
  place={name:"Synthetic airport",types:["airport"],formatted_address:"Synthetic public airport address",geometry:{location:{lat:()=>18.47,lng:()=>-69.9}},address_components:[{types:["locality"],long_name:"Santo Domingo"}]};
  changed();assert.equal(first.length,1);assert.equal(first[0].city,"Santo Domingo");
  const tree=render({...firstProps,onSelect:value=>second.push(value)});
  changed();assert.equal(first.length,1);assert.equal(second.length,1);
  find(tree,node=>node.type==="input").props.onChange({target:{value:"Changed address"}});
  assert.equal(cleared.length,1);
  for(const lat of [NaN,91]){place={geometry:{location:{lat:()=>lat,lng:()=>-69.9}}};changed();}
  assert.equal(second.length,1);assert.equal(cleared.length,3);
  cleanup();assert.equal(removed,true);
  place={geometry:{location:{lat:()=>18.47,lng:()=>-69.9}}};changed();
  assert.equal(second.length,1);
});

function airportHarness(){
  const refs=[],states=[],effects=[],requests=[],timers=new Map(),selected=[],cleared=[];
  let refIndex=0,stateIndex=0,effectIndex=0,nextTimer=0;
  const google={maps:{places:{Autocomplete:class{addListener(){return{remove(){}};}}},Geocoder:class{
    geocode(query){return new Promise((resolve,reject)=>requests.push({query,resolve,reject}));}
  }}};
  const browser={google,setTimeout:callback=>{const id=++nextTimer;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id)};
  const load=sourceLoader({
    react:{useRef:initial=>{const i=refIndex++;return refs[i]??={current:i===0?{}:initial};},useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=value;}];},useEffect:callback=>{effects[effectIndex++]=callback;}},
    "@/shared/hooks/use-google-maps":{useGoogleMaps:()=>({loaded:true,error:null})},
  },{window:browser,google});
  const component=load("src/shared/components/address-autocomplete.tsx").AddressAutocomplete;
  let props={countryCode:"DO",onSelect:value=>selected.push(value),onClear:()=>cleared.push(true)};
  const render=next=>{props={...props,...next};refIndex=0;stateIndex=0;effectIndex=0;return component(props);};
  let tree=render();const cleanups=effects.map(effect=>effect());
  const input=()=>find(tree,node=>node.type==="input");
  return{
    requests,timers,selected,cleared,
    render(next){tree=render(next);return tree;},
    type(value){input().props.onChange({target:{value}});tree=render();},
    value:()=>input().props.value,
    button:()=>find(tree,node=>node.type==="button"&&node.props.children==="Find airport location"),
    unmount(){for(const cleanup of cleanups)cleanup?.();},
  };
}
const airportResponse=(overrides={})=>({results:[{types:["airport"],formatted_address:"Synthetic provider-confirmed airport address",geometry:{location:{lat:()=>18.47,lng:()=>-69.9}},address_components:[{types:["locality"],long_name:"Synthetic city"}],...overrides}]});
await check("Exact verified IATA aliases do not rewrite arbitrary words or another rental country",()=>{
  const {recognizedAirport}=sourceLoader()("src/shared/helpers/address-airports.ts");
  for(const code of ["STI","PUJ","SDQ"]){
    const airport=recognizedAirport(` ${code.toLowerCase()} `,"do");
    assert.equal(airport.code,code);assert.ok(airport.query.includes("Dominican Republic"));
    assert.equal(Object.hasOwn(airport,"lat"),false);assert.equal(Object.hasOwn(airport,"lng"),false);
  }
  for(const query of ["car","STI terminal","xSTI","Santo Domingo"]){assert.equal(recognizedAirport(query,"DO"),undefined);}
  assert.equal(recognizedAirport("STI","US"),undefined);
});
await check("IATA input requires an explicit airport lookup and actual provider airport geometry",async()=>{
  const h=airportHarness();h.type("sti");
  assert.equal(h.value(),"sti");assert.equal(h.requests.length,0);assert.equal(h.selected.length,0);
  assert.equal(h.cleared.length,1);
  const button=h.button();assert.ok(button);
  const pending=button.props.onClick();await button.props.onClick();
  assert.equal(h.requests.length,1);
  assert.match(h.requests[0].query.address,/Aeropuerto Internacional del Cibao/);
  assert.equal(h.requests[0].query.componentRestrictions.country,"DO");
  assert.equal(h.selected.length,0);
  h.requests[0].resolve(airportResponse());await pending;h.render();
  assert.equal(h.selected.length,1);assert.equal(h.selected[0].city,"Synthetic city");
  assert.equal(h.value(),"Synthetic provider-confirmed airport address");
  h.unmount();
});
await check("Airport lookup refuses a city center, blank formatted address and invalid coordinates",async()=>{
  for(const override of [{types:["locality"]},{formatted_address:" "},{geometry:{location:{lat:()=>NaN,lng:()=>-69.9}}}]){
    const h=airportHarness();h.type("STI");const pending=h.button().props.onClick();
    h.requests[0].resolve(airportResponse(override));await pending;
    assert.equal(h.selected.length,0);assert.ok(find(h.render(),node=>node.props?.role==="alert"));h.unmount();
  }
});
await check("Airport errors allow retry but edits, timeouts and unmount ignore late responses",async()=>{
  const retry=airportHarness();retry.type("STI");let pending=retry.button().props.onClick();
  retry.requests[0].reject(new Error("provider denied"));await pending;retry.render();
  pending=retry.button().props.onClick();retry.requests[1].resolve(airportResponse());await pending;
  assert.equal(retry.selected.length,1);retry.unmount();
  for(const cancel of ["edit","timeout","unmount"]){
    const h=airportHarness();h.type("STI");const late=h.button().props.onClick();
    if(cancel==="edit")h.type("Another address");else if(cancel==="timeout")[...h.timers.values()][0]();else h.unmount();
    h.requests[0].resolve(airportResponse());await late;assert.equal(h.selected.length,0);
    if(cancel!=="unmount")h.unmount();
  }
});
console.log(`${checks} maps loader and address lifecycle runtime checks passed; no provider requests made.`);
