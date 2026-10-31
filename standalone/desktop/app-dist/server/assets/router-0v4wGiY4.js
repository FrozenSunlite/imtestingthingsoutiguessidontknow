import * as React from "react";
import { ErrorComponent, HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRoute, createRouter, lazyRouteComponent, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
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
//#region src/index.css?url
var src_default = "/assets/index-DkbU-Ze5.css";
//#endregion
//#region src/routes/__root.jsx
var Route$1 = createRootRoute({
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
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(Toaster$1, {})] });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", {
			"data-react-root": "true",
			children: [children, /* @__PURE__ */ jsx(Scripts, {})]
		})]
	});
}
//#endregion
//#region src/routes/index.jsx
var $$splitComponentImporter = () => import("./routes-CTLPRMcG.js");
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = { IndexRoute: createFileRoute("/")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	head: () => ({ meta: [{ title: "I'm Trying's Terrific Talent Tree" }, {
		name: "description",
		content: "Build and play homebrew D&D 5e talent trees with a live character sheet."
	}] })
}).update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$1
}) };
var routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.jsx
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
		scrollRestoration: true
	});
}
//#endregion
export { getRouter, Button as n, cn as r, router_exports as t };
