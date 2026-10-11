import type {ForwardRefExoticComponent,TextareaHTMLAttributes,RefAttributes} from 'react';
declare const BoundedTextarea:ForwardRefExoticComponent<TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minHeight?:number;
  maxHeight?:number;
  wrapperClassName?:string;
} & RefAttributes<HTMLTextAreaElement>>;
export default BoundedTextarea;
