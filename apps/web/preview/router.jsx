import React, { createContext, useContext } from "react";
export const RouterContext = createContext({ pathname: "/", search: "", hash: "" });
export function useLocation() {
  return useContext(RouterContext);
}
export function useHistory() {
  return {
    push(to) {
      window.location.hash = to;
    },
    replace(to) {
      window.history.replaceState(null, "", "#" + to);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    goBack() {
      window.history.back();
    },
  };
}
export function useRouteMatch() {
  return { path: useContext(RouterContext).pathname };
}
export default function RouterLink({ to, href, children, onClick, ...rest }) {
  const target = to || href || "/";
  const mapped = target.startsWith("/") ? "#" + target : target;
  return (
    <a {...rest} href={mapped} onClick={onClick}>
      {children}
    </a>
  );
}
