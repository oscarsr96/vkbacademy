import { SetMetadata } from '@nestjs/common';

/** Marca un endpoint como permitido aunque el usuario tenga mustChangePassword=true */
export const ALLOW_WHEN_MUST_CHANGE = 'allowWhenMustChange';
export const AllowWhenMustChange = () => SetMetadata(ALLOW_WHEN_MUST_CHANGE, true);
