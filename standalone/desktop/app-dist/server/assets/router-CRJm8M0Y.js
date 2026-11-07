import * as React from "react";
import { ErrorComponent, HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRoute, createRouter, lazyRouteComponent, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
// \0rolldown/runtime.js
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
// src/lib/utils.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
// src/components/ui/button.jsx
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
// src/components/DefaultCatchBoundary.jsx
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
// src/components/NotFound.jsx
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
// src/components/ui/sonner.jsx
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
// src/lib/diagnostics.js
var STORAGE_KEY = "skilltree:diagnostics";
var MAX_TEXT = 6e3;
var EMPTY = [];
var entries = EMPTY;
var loaded = false;
var installed = false;
var persistTimer = 0;
var listeners = /* @__PURE__ */ new Set();
var truncate = (value) => {
	const text = String(value ?? "");
	return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n… [truncated]` : text;
};
var safeText = (value, depth = 0) => {
	if (value == null) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
	if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
	if (typeof value === "object") {
		if (depth > 3) return "[object]";
		try {
			const seen = /* @__PURE__ */ new WeakSet();
			return JSON.stringify(value, (_key, item) => {
				if (typeof item === "bigint") return `${item}n`;
				if (typeof item === "function") return "[function]";
				if (typeof item === "object" && item !== null) {
					if (seen.has(item)) return "[circular]";
					seen.add(item);
				}
				return item;
			});
		} catch {
			try {
				return String(value);
			} catch {
				return "[object]";
			}
		}
	}
	return String(value);
};
var notify = () => {
	listeners.forEach((listener) => {
		try {
			listener(entries);
		} catch {}
	});
};
var readStored = () => {
	if (loaded) return;
	loaded = true;
	if (typeof window === "undefined") return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return;
		entries = parsed.filter((entry) => entry && typeof entry === "object" && entry.message).slice(-250).map((entry) => ({
			id: String(entry.id || ""),
			at: String(entry.at || ""),
			level: String(entry.level || "error"),
			message: String(entry.message || ""),
			detail: String(entry.detail || ""),
			url: String(entry.url || "")
		}));
	} catch {
		entries = EMPTY;
	}
};
var flushStored = () => {
	if (typeof window === "undefined") return;
	try {
		if (!entries.length) window.localStorage.removeItem(STORAGE_KEY);
		else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch {}
};
var schedulePersist = () => {
	if (typeof window === "undefined") return;
	window.clearTimeout(persistTimer);
	persistTimer = window.setTimeout(flushStored, 200);
};
function logDiagnostic(level, message, detail = "") {
	readStored();
	const text = safeText(message);
	if (!text) return null;
	const entry = {
		id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
		at: (/* @__PURE__ */ new Date()).toISOString(),
		level: String(level || "error").toLowerCase(),
		message: truncate(text),
		detail: truncate(safeText(detail)),
		url: typeof location !== "undefined" ? location.href : ""
	};
	entries = [...entries, entry].slice(-250);
	schedulePersist();
	notify();
	return entry;
}
function getDiagnostics() {
	readStored();
	return entries;
}
function subscribeDiagnostics(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
function clearDiagnostics() {
	readStored();
	entries = EMPTY;
	if (typeof window !== "undefined") {
		window.clearTimeout(persistTimer);
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {}
	}
	notify();
}
function formatDiagnostics(list = getDiagnostics(), { newestFirst = true } = {}) {
	const ordered = newestFirst ? [...list].reverse() : list;
	const header = [
		"Talent Tree diagnostic log",
		`Exported: ${(/* @__PURE__ */ new Date()).toISOString()}`,
		`Page: ${typeof location !== "undefined" ? location.href : ""}`,
		`User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
		`Platform: ${typeof navigator !== "undefined" ? navigator.platform : ""}`,
		`Entries: ${ordered.length}`,
		""
	];
	const body = ordered.map((entry) => {
		const lines = [`[${entry.at}] ${String(entry.level || "error").toUpperCase()} ${entry.message}`];
		if (entry.detail) lines.push(entry.detail);
		if (entry.url) lines.push(`at ${entry.url}`);
		return lines.join("\n");
	});
	return [...header, ...body].join("\n\n");
}
async function copyDiagnostics(list = getDiagnostics()) {
	const text = formatDiagnostics(list);
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
function downloadDiagnostics(list = getDiagnostics()) {
	const text = formatDiagnostics(list);
	const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	try {
		const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `talent-tree-diagnostics-${stamp}.txt`;
		a.click();
		URL.revokeObjectURL(url);
		return true;
	} catch {
		return false;
	}
}
var shouldLogRequest = (rawUrl) => {
	if (typeof location === "undefined") return false;
	try {
		const url = new URL(String(rawUrl || ""), location.href);
		if (url.origin !== location.origin) return false;
		if (!url.pathname.startsWith("/api/")) return false;
		return !/^\/api\/(5etools\/)?(image|brew-image|image-proxy)/.test(url.pathname);
	} catch {
		return false;
	}
};
function installDiagnostics() {
	if (installed || typeof window === "undefined") return;
	installed = true;
	readStored();
	const originalError = console.error;
	console.error = (...args) => {
		logDiagnostic("error", args.map((arg) => safeText(arg)).join(" "));
		originalError.apply(console, args);
	};
	const originalWarn = console.warn;
	console.warn = (...args) => {
		logDiagnostic("warn", args.map((arg) => safeText(arg)).join(" "));
		originalWarn.apply(console, args);
	};
	window.addEventListener("error", (event) => {
		const source = event.filename ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}` : "";
		logDiagnostic("error", event.message || "Uncaught error", event.error?.stack || source);
	});
	window.addEventListener("unhandledrejection", (event) => {
		logDiagnostic("error", "Unhandled promise rejection", safeText(event.reason));
	});
	if (typeof toast?.error === "function") {
		const originalToastError = toast.error;
		toast.error = (...args) => {
			const data = args[1];
			const detail = typeof data === "string" ? data : data?.description ? safeText(data.description) : "";
			logDiagnostic("error", args[0], detail);
			return originalToastError(...args);
		};
	}
	if (typeof window.fetch === "function") {
		const originalFetch = window.fetch;
		window.fetch = function diagnosticFetch(...args) {
			const input = args[0];
			const url = typeof input === "string" ? input : input?.url || "";
			return originalFetch.apply(this, args).then((response) => {
				if (!response.ok && shouldLogRequest(url)) logDiagnostic("warn", `HTTP ${response.status} ${url}`, response.statusText || "");
				return response;
			}).catch((error) => {
				if (shouldLogRequest(url)) logDiagnostic("error", `Network request failed: ${url}`, safeText(error));
				throw error;
			});
		};
	}
	window.addEventListener("pagehide", flushStored);
	window.addEventListener("beforeunload", flushStored);
}
// src/index.css?url
var src_default = "/assets/index-C9-GmdGX.css";
// src/routes/__root.jsx
if (typeof window !== "undefined") installDiagnostics();
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
			},
			{
				name: "theme-color",
				content: "#0b1020"
			},
			{
				name: "mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: src_default
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest"
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/icons/icon-192.png"
			},
			{
				rel: "apple-touch-icon",
				href: "/icons/apple-touch-icon.png"
			}
		]
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
// src/routes/index.jsx
var $$splitComponentImporter = () => import("./routes-BEWuPzqM.js");
// src/routeTree.gen.ts
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
// src/router.jsx
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
export { formatDiagnostics as a, Button as c, getRouter, downloadDiagnostics as i, cn as l, clearDiagnostics as n, getDiagnostics as o, copyDiagnostics as r, subscribeDiagnostics as s, router_exports as t };
