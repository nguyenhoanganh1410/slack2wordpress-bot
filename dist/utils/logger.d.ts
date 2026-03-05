import winston from 'winston';
declare const logger: winston.Logger;
export declare const loggerTyped: {
    info: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    debug: (message: string, meta?: any) => void;
};
export { logger };
export default loggerTyped;
//# sourceMappingURL=logger.d.ts.map