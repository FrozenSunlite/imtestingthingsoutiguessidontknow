import * as React from "react";
import { Fragment, createContext, createElement, useEffect, useMemo } from "react";
import { ErrorComponent, HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRoute, createRouter, lazyRouteComponent, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { QueryClient, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getAccessToken } from "@base44/sdk";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/lib/utils.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region src/components/ui/button.jsx
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
			outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ jsx(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
//#endregion
//#region src/components/DefaultCatchBoundary.jsx
function DefaultCatchBoundary({ error }) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto flex max-w-2xl flex-col items-center gap-4 py-24",
		children: [/* @__PURE__ */ jsx(ErrorComponent, { error }), /* @__PURE__ */ jsxs("div", {
			className: "flex gap-2",
			children: [/* @__PURE__ */ jsx(Button, {
				variant: "outline",
				onClick: () => router.invalidate(),
				children: "Try again"
			}), /* @__PURE__ */ jsx(Button, {
				asChild: true,
				children: isRoot ? /* @__PURE__ */ jsx(Link, {
					to: "/",
					children: "Home"
				}) : /* @__PURE__ */ jsx(Link, {
					to: "/",
					onClick: (e) => {
						e.preventDefault();
						window.history.back();
					},
					children: "Go back"
				})
			})]
		})]
	});
}
//#endregion
//#region src/components/NotFound.jsx
function NotFound({ children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-6xl font-semibold tracking-tight",
				children: "404"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "text-muted-foreground",
				children: children ?? "The page you are looking for does not exist."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ jsx(Button, {
					variant: "outline",
					onClick: () => window.history.back(),
					children: "Go back"
				}), /* @__PURE__ */ jsx(Button, {
					asChild: true,
					children: /* @__PURE__ */ jsx(Link, {
						to: "/",
						children: "Start over"
					})
				})]
			})
		]
	});
}
//#endregion
//#region src/components/ui/sonner.jsx
var Toaster$1 = ({ ...props }) => {
	const { theme = "system" } = useTheme();
	return /* @__PURE__ */ jsx(Toaster, {
		theme,
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
//#endregion
//#region src/lib/app-params.js
var isBrowser = typeof window !== "undefined";
var isClearAccessTokenRequested = () => isBrowser && new URLSearchParams(window.location.search).get("clear_access_token") === "true";
var clearStoredAccessToken = () => {
	window.localStorage.removeItem("base44_access_token");
	window.localStorage.removeItem("token");
};
function getAppParams() {
	if (isClearAccessTokenRequested()) clearStoredAccessToken();
	return {
		appId: void 0,
		token: isBrowser ? getAccessToken() : null,
		functionsVersion: isBrowser && new URLSearchParams(window.location.search).get("functions_version")?.trim() || void 0,
		appBaseUrl: void 0
	};
}
//#endregion
//#region src/api/base44Client.js
var { appId, token, functionsVersion, appBaseUrl } = getAppParams();
var base44 = createClient({
	appId,
	token: token ?? void 0,
	functionsVersion,
	serverUrl: "",
	appBaseUrl
});
//#endregion
//#region src/lib/authReturnTo.js
var AUTH_PAGES = /* @__PURE__ */ new Set([
	"/login",
	"/register",
	"/forgot-password",
	"/reset-password"
]);
function sanitizeReturnTo(raw) {
	if (!raw || typeof window === "undefined") return "/";
	try {
		const url = new URL(raw, window.location.origin);
		if (url.origin !== window.location.origin) return "/";
		for (const p of [
			"access_token",
			"clear_access_token",
			"app_id",
			"app_base_url",
			"functions_version",
			"from_url",
			"returnTo"
		]) url.searchParams.delete(p);
		if (AUTH_PAGES.has(url.pathname.replace(/\/+$/, "") || "/")) return "/";
		const path = url.pathname + url.search;
		if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
		return path;
	} catch {
		return "/";
	}
}
function currentPath() {
	if (typeof window === "undefined") return "/";
	return sanitizeReturnTo(window.location.pathname + window.location.search);
}
function currentUrl() {
	if (typeof window === "undefined") return "/";
	return window.location.origin + currentPath();
}
//#endregion
//#region src/lib/AuthContext.jsx
/**
* The visitor, resolved once per page load and cached in the router's QueryClient:
* the login gate (src/components/auth/AuthGate.jsx) reads it with
* `context.queryClient.ensureQueryData(authQuery)`, components with `useAuth()`.
* Resolves to `{ user, error }`: an anonymous visitor (no token, or a 401/403) is `{ user: null, error: null }`.
* Anything else, an outage (429, 503) or a request that never got an answer, rejects instead,
* so it is never cached as "signed out" and the next read asks again.
*/
var authQuery = queryOptions({
	queryKey: ["auth", "me"],
	queryFn: async () => {
		if (!base44.auth.hasToken()) return {
			user: null,
			error: null
		};
		try {
			return {
				user: await base44.auth.me(),
				error: null
			};
		} catch (err) {
			if (err?.data?.extra_data?.reason === "user_not_registered") return {
				user: null,
				error: {
					type: "user_not_registered",
					message: "Not registered"
				}
			};
			if (err?.status === 401 || err?.status === 403) return {
				user: null,
				error: null
			};
			throw err;
		}
	},
	staleTime: Infinity,
	retry: false
});
var AuthContext = createContext(null);
/**
* Client-side session state. The server renders every page anonymously and the
* query only runs in the browser after hydration, so the first client render
* matches the server markup. Gate user-specific UI on `isLoadingAuth`.
*/
function AuthProvider({ children }) {
	const queryClient = useQueryClient();
	const { data, error, isPending } = useQuery(authQuery);
	const value = useMemo(() => ({
		user: data?.user ?? null,
		isAuthenticated: !!data?.user,
		isLoadingAuth: isPending,
		authError: data?.error ?? (error ? {
			type: "unknown",
			message: error.message ?? "Failed to load session"
		} : null),
		refresh: () => queryClient.fetchQuery({
			...authQuery,
			staleTime: 0
		}),
		logout: () => {
			queryClient.setQueryData(authQuery.queryKey, {
				user: null,
				error: null
			});
			base44.auth.logout(window.location.origin);
		},
		navigateToLogin: () => base44.auth.redirectToLogin(currentUrl())
	}), [
		data,
		error,
		isPending,
		queryClient
	]);
	return /* @__PURE__ */ jsx(AuthContext.Provider, {
		value,
		children
	});
}
//#endregion
//#region \0base44:document
var SCRIPTS = [];
function Base44Scripts() {
	return createElement(Fragment, null, ...SCRIPTS.map((script, index) => "src" in script ? createElement("script", {
		key: index,
		type: script.classic ? void 0 : "module",
		src: script.src
	}) : createElement("script", {
		key: index,
		type: "module",
		suppressHydrationWarning: true,
		dangerouslySetInnerHTML: { __html: script.children }
	})));
}
//#endregion
//#region src/index.css?url
var src_default = "/assets/index-DiK1s8ny.css";
//#endregion
//#region src/routes/__root.jsx
var Route$2 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "I'm Trying's Terrific Talent Tree" },
			{
				name: "description",
				content: "Build and play homebrew D&D 5e talent trees with a live character sheet."
			}
		],
		links: [{
			rel: "stylesheet",
			href: src_default
		}]
	}),
	errorComponent: DefaultCatchBoundary,
	notFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
	shellComponent: RootDocument,
	component: RootComponent
});
function RootComponent() {
	useEffect(() => {
		const handler = (e) => {
			e.preventDefault();
			e.returnValue = "";
			return "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, []);
	return /* @__PURE__ */ jsxs(AuthProvider, { children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(Toaster$1, {})] });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", {
			"data-react-root": "true",
			children: [
				children,
				/* @__PURE__ */ jsx(Base44Scripts, {}),
				/* @__PURE__ */ jsx(Scripts, {})
			]
		})]
	});
}
//#endregion
//#region src/routes/index.jsx
var $$splitComponentImporter = () => import("./routes-BfdVD4H-.js");
var Route$1 = createFileRoute("/")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	head: () => ({ meta: [{ title: "I'm Trying's Terrific Talent Tree" }, {
		name: "description",
		content: "Build and play homebrew D&D 5e talent trees with a live character sheet."
	}] })
});
//#endregion
//#region src/routes/api/time.js
var Route = createFileRoute("/api/time")({ server: { handlers: { GET: async () => Response.json({ now: (/* @__PURE__ */ new Date()).toISOString() }, { headers: { "cache-control": "no-store" } }) } } });
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = {
	IndexRoute: Route$1.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$2
	}),
	ApiTimeRoute: Route.update({
		id: "/api/time",
		path: "/api/time",
		getParentRoute: () => Route$2
	})
};
var routeTree = Route$2._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/lib/query-client.js
var createQueryClient = () => new QueryClient({ defaultOptions: { queries: {
	staleTime: 3e4,
	refetchOnWindowFocus: false
} } });
//#endregion
//#region src/router.jsx
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	const queryClient = createQueryClient();
	const router = createRouter({
		routeTree,
		context: { queryClient },
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
		scrollRestoration: true
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient
	});
	return router;
}
//#endregion
export { getRouter, cn as i, base44 as n, Button as r, router_exports as t };
