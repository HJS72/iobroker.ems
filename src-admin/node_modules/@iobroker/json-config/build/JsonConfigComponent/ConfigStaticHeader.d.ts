import { type JSX } from 'react';
import type { ConfigItemStaticHeader } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemStaticHeader;
}
declare class ConfigStaticHeader extends ConfigGeneric<ConfigInstanceSelectProps, ConfigGenericState> {
    renderItem(): JSX.Element;
}
export default ConfigStaticHeader;
