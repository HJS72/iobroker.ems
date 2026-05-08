import { type JSX } from 'react';
import type { ConfigItemPattern } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigPatternProps extends ConfigGenericProps {
    schema: ConfigItemPattern;
}
declare class ConfigPattern extends ConfigGeneric<ConfigPatternProps, ConfigGenericState> {
    renderItem(_error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigPattern;
