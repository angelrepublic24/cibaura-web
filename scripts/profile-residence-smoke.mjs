import assert from "node:assert/strict";
import { sourceLoader, find } from "./helpers/source-runtime.mjs";

const plain = value => JSON.parse(JSON.stringify(value));
const requests = [];
let response;
const Api = Object.fromEntries(["get", "patch"].map(method => [method, async (url, body) => {
  requests.push({method,url,body});
  return {data:response};
}]));
const load = sourceLoader({
  "@/shared/api/client": {Api,withSessionBoundary: operation => operation()},
  "@tanstack/react-query": {useQuery: options => options, skipToken: Symbol("skip")},
});
const hooks = load("src/modules/catalog/hooks/catalog.hook.ts");
const auth = load("src/modules/auth/services/auth.service.ts").authService;
const wire = {id:"customer",name:"QA Customer",email:"qa@example.invalid",phone:null,roles:["customer"],agencyId:null,termsVersion:"2026-09-08",status:"active",createdAt:"2026-11-14T00:00:00Z",dateOfBirth:"1990-01-01",countryId:null,cityId:null,residenceCountryCode:"FR",residenceCity:"Paris",marketingOptIn:false};
let checks = 0;
async function check(name, run) {await run();checks++;console.log(`PASS ${name}`);}

await check("Residence uses a distinct global catalog and query cache from operating markets", async () => {
  const global = hooks.useResidenceCountries();
  const market = hooks.useCountries();
  assert.notDeepEqual(plain(global.queryKey),plain(market.queryKey));
  response = [{code:"FR",name:"France"},{code:"JP",name:"Japan"}];
  assert.equal((await global.queryFn())[0].code,"FR");
  assert.equal(requests.at(-1).url,"/geo/residence-countries");
  response = [{id:"do-id",name:"Dominican Republic",code:"DO",taxRatePct:null}];
  await market.queryFn();
  assert.equal(requests.at(-1).url,"/geo/countries");
});
await check("Profile service reads and writes global residence without inventing marketplace IDs", async () => {
  response = wire;
  const user = await auth.me();
  assert.equal(user.residenceCountryCode,"FR");
  assert.equal(user.residenceCity,"Paris");
  await auth.updateMe({residenceCountryCode:"JP",residenceCity:"  Tokyo  ",roles:["platform_admin"]});
  assert.deepEqual(plain(requests.at(-1).body),{residenceCountryCode:"JP",residenceCity:"Tokyo"});
  await auth.updateMe({residenceCountryCode:null,residenceCity:null});
  assert.deepEqual(plain(requests.at(-1).body),{residenceCountryCode:null,residenceCity:null});
});

let values = {fullName:"QA Customer",phone:"",dateOfBirth:"1990-01-01",residenceCountryCode:"FR",residenceCity:"Paris"};
const saved = [];
const resets = [];
const form = {
  formState:{errors:{},isDirty:false},
  register(name,options){return {name,onChange:event=>{values[name]=event.target.value;options?.onChange?.(event);}};},
  watch:name=>values[name],
  setValue:(name,value)=>{values[name]=value;},
  reset:value=>resets.push(value),
};
let resolver;
const panelLoad = sourceLoader({
  react:{useEffect(){},useRef: initial=>({current:initial})},
  "next/link":{default:"Link"},
  "react-hook-form":{useForm: options=>{resolver=options.resolver;return {...form,handleSubmit:callback=>async()=>{
    const result=await resolver(values,{}, {criteriaMode:"firstError",shouldUseNativeValidation:false,fields:{}});
    if(!Object.keys(result.errors).length)callback(result.values);
  }};}},
  "@tanstack/react-query":{useQueryClient:()=>({setQueryData(){},invalidateQueries(){}})},
  "@/modules/auth/hooks/auth.hook":{authKeys:{me:()=>["auth","me"]},useMe:()=>({data:{...wire,fullName:wire.name}}),useUpdateMe:()=>({mutate:value=>saved.push(value),reset(){}})},
  "@/modules/catalog/hooks/catalog.hook":{useResidenceCountries:()=>({data:[{code:"FR",name:"France"},{code:"JP",name:"Japan"}],isPending:false,isError:false})},
  "@/modules/verification/hooks/verification.hook":{verificationKeys:{all:["verification"]}},
  "@/shared/auth/store":{useAuthStore:selector=>selector({setUser(){}})},
  "@/shared/components/ui/button":{Button:"Button"},
  "./settings-section":{SettingsEditorRow:"SettingsEditorRow",SettingsPageTitle:"SettingsPageTitle"},
});
const Profile = panelLoad("src/modules/account/components/profile-panel.tsx").ProfilePanel;
await check("Actual Profile offers worldwide country codes and a free-text city, retaining fill-once DOB", async () => {
  let tree=Profile();
  const country=find(tree,node=>node.props?.id==="profile-country");
  assert.equal(country.props.name,"residenceCountryCode");
  assert.equal(find(country,node=>node.type==="option"&&node.props.value==="FR").props.children,"France");
  const city=find(tree,node=>node.props?.id==="profile-city");
  assert.equal(city.type,"input");assert.equal(city.props.maxLength,160);
  assert.equal(find(tree,node=>node.props?.id==="profile-dob").props.readOnly,true);
  country.props.onChange({target:{value:"JP"}});
  assert.equal(values.residenceCity,"");
  tree=Profile();
  find(tree,node=>node.props?.id==="profile-city").props.onChange({target:{value:"Tokyo"}});
  await find(tree,node=>node.type==="form").props.onSubmit();
  assert.deepEqual(plain(saved.at(-1)),{fullName:"QA Customer",phone:null,residenceCountryCode:"JP",residenceCity:"Tokyo"});
});
await check("Clearing residence clears city explicitly; invalid city length never submits", async () => {
  let tree=Profile();
  find(tree,node=>node.props?.id==="profile-country").props.onChange({target:{value:""}});
  tree=Profile();
  assert.equal(find(tree,node=>node.props?.id==="profile-city").props.disabled,true);
  await find(tree,node=>node.type==="form").props.onSubmit();
  assert.equal(saved.at(-1).residenceCountryCode,null);assert.equal(saved.at(-1).residenceCity,null);
  const before=saved.length;
  for (const residenceCity of ["x".repeat(161), "Paris\nFrance", "City\u007fTown"]) {
    values={...values,residenceCountryCode:"FR",residenceCity};
    await find(Profile(),node=>node.type==="form").props.onSubmit();
  }
  assert.equal(saved.length,before);
});
console.log(`${checks} profile residence runtime checks passed.`);
