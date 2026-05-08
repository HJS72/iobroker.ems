import { type JSX } from 'react';
import type { ConfigItemStaticText } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigStaticTextProps extends ConfigGenericProps {
    schema: ConfigItemStaticText;
}
declare class ConfigStaticText extends ConfigGeneric<ConfigStaticTextProps, ConfigGenericState> {
    renderItem(_error: string, disabled: boolean): JSX.Element;
}
export default ConfigStaticText;
