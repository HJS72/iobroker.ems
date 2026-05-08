import { type JSX } from 'react';
import type { ConfigItemStaticImage } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemStaticImage;
}
declare class ConfigStaticImage extends ConfigGeneric<ConfigInstanceSelectProps, ConfigGenericState> {
    renderItem(): JSX.Element;
}
export default ConfigStaticImage;
