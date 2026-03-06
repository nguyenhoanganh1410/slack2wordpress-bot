import { Request, Response } from 'express';
import { AppError } from '../types';
declare const errorHandler: (err: Error | AppError, req: Request, res: Response, _next: any) => void;
export { errorHandler };
export default errorHandler;
//# sourceMappingURL=errorHandler.d.ts.map