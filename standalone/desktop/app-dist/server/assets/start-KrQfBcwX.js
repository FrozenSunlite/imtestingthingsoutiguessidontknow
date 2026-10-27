import { a as setResponseStatus, n as getRequest, t as createMiddleware } from "./createMiddleware-DWjFg8tL.js";
import { createClientFromRequest, getAccessToken } from "@base44/sdk";
//#region node_modules/@tanstack/start-client-core/dist/esm/createStart.js
function dedupeSerializationAdapters(deduped, serializationAdapters) {
	for (let i = 0, len = serializationAdapters.length; i < len; i++) {
		const current = serializationAdapters[i];
		if (!deduped.has(current)) {
			deduped.add(current);
			if (current.extends) dedupeSerializationAdapters(deduped, current.extends);
		}
	}
}
var createStart = (getOptions) => {
	return {
		getOptions: async () => {
			const options = await getOptions();
			if (options.serializationAdapters) {
				const deduped = /* @__PURE__ */ new Set();
				dedupeSerializationAdapters(deduped, options.serializationAdapters);
				options.serializationAdapters = Array.from(deduped);
			}
			return options;
		},
		createMiddleware
	};
};
//#endregion
//#region src/lib/auth-middleware.js
var withGetBase44 = (next, request = getRequest()) => {
	let client;
	return next({ context: { getBase44: () => client ??= createClientFromRequest(request) } });
};
var authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const token = typeof window === "undefined" ? null : getAccessToken();
	return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
}).server(({ next }) => withGetBase44(next));
var base44RequestMiddleware = createMiddleware({ type: "request" }).server(({ next, request }) => withGetBase44(next, request));
var currentUser = (context) => context.getBase44().auth.me().catch((error) => {
	if (error?.status === 401 || error?.status === 403) return null;
	throw error;
});
createMiddleware({ type: "function" }).server(async ({ next, context }) => {
	const user = await currentUser(context);
	if (!user) {
		setResponseStatus(401);
		throw Object.assign(/* @__PURE__ */ new Error("Unauthorized"), {
			status: 401,
			code: "UNAUTHORIZED"
		});
	}
	return next({ context: { user } });
});
createMiddleware({ type: "request" }).server(async ({ next, context }) => {
	const user = await currentUser(context);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	return next({ context: { user } });
});
//#endregion
//#region src/start.js
var startInstance = createStart(() => ({
	requestMiddleware: [base44RequestMiddleware],
	functionMiddleware: [authMiddleware]
}));
//#endregion
export { startInstance };
