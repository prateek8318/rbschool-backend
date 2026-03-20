import jwt from 'jsonwebtoken';
import { ITokenPayload } from '../types';

export const generateAccessToken = (
  payload: Omit<ITokenPayload, 'iat' | 'exp'>,
): string =>
  jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });

export const generateRefreshToken = (
  payload: Omit<ITokenPayload, 'iat' | 'exp'>,
): string => jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });

export const verifyAccessToken = (token: string): ITokenPayload =>
  jwt.verify(token, process.env.JWT_SECRET!) as ITokenPayload;

export const verifyRefreshToken = (token: string): ITokenPayload =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as ITokenPayload;
