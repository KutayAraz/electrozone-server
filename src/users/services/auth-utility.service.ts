import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities/User.entity';
import { Tokens, JwtPayload } from '../types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthUtilityService {
    constructor(private readonly jwtService: JwtService,
        private config: ConfigService,
    ) { }

    capitalizeFirstLetterOfEachWord(input: string): string {
        return input
            .split(" ")
            .map(word => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1).toLocaleLowerCase("tr-TR"))
            .join(" ");
    }

    isPasswordStrong(password: string): boolean {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasNonalphas = /\W/.test(password);
        return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
    }

    setRefreshTokenCookie(res: Response, token: string): void {
        res.cookie('refresh_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // or use "none"
            sameSite: 'strict',
            maxAge: 5 * 24 * 60 * 60 * 1000, // 5 days
        });
    }

    async updateRtHash(userUuid: string, rt: string, manager: EntityManager): Promise<void> {
        const hashedRt = await this.hashPassword(rt);
        await manager.update(User, { uuid: userUuid }, { hashedRt });
    }

    async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, 12);
    }

    async getTokens(user: User): Promise<Tokens> {
        const jwtPayload: JwtPayload = {
            sub: user.uuid,
            email: user.email,
        };

        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(jwtPayload, {
                secret: this.config.get<string>("AT_SECRET"),
                expiresIn: "15m",
            }),
            this.jwtService.signAsync(jwtPayload, {
                secret: this.config.get<string>("RT_SECRET"),
                expiresIn: "5d",
            }),
        ]);

        return {
            access_token: at,
            refresh_token: rt,
        };
    }
}