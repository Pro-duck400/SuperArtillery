import type { RequestHandler, RouteParameters } from 'express-serve-static-core';

export type ContractRouteHandler<Path extends string, RequestBody, ResponseBody> =
  RequestHandler<RouteParameters<Path>, ResponseBody, RequestBody>;
