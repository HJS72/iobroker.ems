import { type JSX } from 'react';
import type { ConfigItemStaticInfo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigStaticInfoProps extends ConfigGenericProps {
    schema: ConfigItemStaticInfo;
}
declare class ConfigStaticInfo extends ConfigGeneric<ConfigStaticInfoProps, ConfigGenericState> {
    renderItem(_error: string): JSX.Element;
}
export default ConfigStaticInfo;
