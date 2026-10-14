import {z} from 'zod';

const reserved=new Set(['admin','administrator','root','system','support','security','moderator','rocowiki','api','auth']);
export const usernameSchema=z.string().trim().toLowerCase().min(3).max(24)
  .regex(/^[a-z][a-z0-9_-]*$/).refine(value=>!reserved.has(value));
export const emailSchema=z.string().trim().toLowerCase().max(254).email();
export const displayNameSchema=z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f<>]+$/u);
export const profileAvatars = ['dimo', 'haifu', 'bishui', 'sailemu'] as const;
export const avatarSchema = z.enum(profileAvatars);
export const biographySchema = z.string().trim().max(160).regex(/^[^\u0000-\u001f\u007f<>]*$/u);
export const passwordSchema=z.string().min(15).max(128)
  .refine(value=>new TextEncoder().encode(value).byteLength<=512)
  .refine(value=>!new Set(['123456789012345','passwordpassword','1234567890123456','qwertyuiopasdfgh']).has(value.toLowerCase()));
export const registerSchema=z.object({email:emailSchema,username:usernameSchema,display_name:displayNameSchema,password:passwordSchema}).strict();
export const loginSchema=z.object({identifier:z.string().trim().toLowerCase().min(1).max(254),password:z.string().min(1).max(128)}).strict();
export const profileSchema=z.object({display_name:displayNameSchema,avatar:avatarSchema.optional(),bio:biographySchema.optional()}).strict();
export const changePasswordSchema=z.object({current_password:z.string().min(1).max(128),new_password:passwordSchema}).strict();
export type Registration=z.infer<typeof registerSchema>;
export type PasswordLogin=z.infer<typeof loginSchema>;
