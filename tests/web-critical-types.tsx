import React from 'react';
import RequireRole,{VerifiedIdentityContext} from '../apps/web/src/wiki/auth/RequireRole';
import BoundedTextarea from '../apps/web/src/wiki/BoundedTextarea';
import {normalizeAvatar} from '../apps/web/src/wiki/community/profileModel';
import {readDemoWorkspace} from '../apps/web/src/wiki/community/workspaceRepository';

// This file is compiled only by the critical-JS project. These assertions fail
// if its public props/data regress to any; they emit no JavaScript.
const valid=<RequireRole review={true}><BoundedTextarea rows={4} minHeight={200}/></RequireRole>;
// @ts-expect-error Permission flags must be booleans.
const invalidGate=<RequireRole review="false">content</RequireRole>;
// @ts-expect-error Textarea height must be a number.
const invalidEditor=<BoundedTextarea minHeight="200"/>;
// @ts-expect-error Identity role must use the verified service enum.
const invalidIdentity=<VerifiedIdentityContext.Provider value={{user:{role:'owner'},loading:false}}>content</VerifiedIdentityContext.Provider>;
// @ts-expect-error Avatar normalization exposes a closed set.
const invalidAvatar:ReturnType<typeof normalizeAvatar>='unknown-avatar';
const local=readDemoWorkspace({getItem:()=>'{"submissions":[{"uid":"not-a-server-identity"}]}'});
// @ts-expect-error Local JSON is unknown data, not an authenticated server UID.
const unverifiedUid:string=local?.submissions[0]?.uid;
void [valid,invalidGate,invalidEditor,invalidIdentity,invalidAvatar,unverifiedUid];
