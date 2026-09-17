'use client';

import { createContext } from 'react';
import type { Me } from './types';

export interface SettingsScope {
  userId: number;
  onSaved?: (user: Me) => void;
}

export const SettingsScopeContext = createContext<SettingsScope | null>(null);
