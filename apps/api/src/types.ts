export interface Secrets {
  OIDC_CLIENT_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  DEPLOY_WEBHOOK_SECRET?: string;
}
export type ApiEnv = Env & Secrets;
export interface User { uid:string; username:string; display_name:string; role:'viewer'|'contributor'|'reviewer'|'admin'; }
export interface AuthSession extends User { id_hash:string; csrf_hash:string; authenticated_at:number; }
export type Bindings = {Bindings:ApiEnv;Variables:{session:AuthSession;correlationId:string}};
