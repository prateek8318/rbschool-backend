import { ITokenPayload } from '../types';
export declare const generateAccessToken: (payload: Omit<ITokenPayload, "iat" | "exp">) => string;
export declare const generateRefreshToken: (payload: Omit<ITokenPayload, "iat" | "exp">) => string;
export declare const verifyAccessToken: (token: string) => ITokenPayload;
export declare const verifyRefreshToken: (token: string) => ITokenPayload;
