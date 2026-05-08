import { type JSX } from 'react';
import type { ConfigItemStaticDivider } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemStaticDivider;
}
declare class ConfigStaticDivider extends ConfigGeneric<ConfigInstanceSelectProps, ConfigGenericState> {
    renderItem(): JSX.Element;
}
export default ConfigStaticDivider;
