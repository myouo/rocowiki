// SPDX-License-Identifier: GPL-3.0-only
import type {ComponentType} from 'react';
import {profileAvatars} from '../../../../packages/wiki-schema/src/account';
export const PROFILE_AVATARS:typeof profileAvatars;
export function normalizeAvatar(value:unknown):typeof profileAvatars[number];
export const ProfileAvatar:ComponentType<{avatar?:string;size?:number;className?:string;labelled?:boolean;frame?:string}>;
export const AvatarPicker:ComponentType<{value:string;onChange:(value:typeof profileAvatars[number])=>void}>;
export const GithubMark:ComponentType<{size?:number}>;
export const HeaderProfileAvatar:ComponentType;
