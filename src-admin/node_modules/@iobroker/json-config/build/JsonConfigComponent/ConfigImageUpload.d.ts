import { type JSX } from 'react';
import type { ConfigItemImageUpload } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigImageUploadProps extends ConfigGenericProps {
    schema: ConfigItemImageUpload;
}
interface ConfigImageUploadState extends ConfigGenericState {
    image?: string;
    oContext?: string;
}
declare class ConfigImageUpload extends ConfigGeneric<ConfigImageUploadProps, ConfigImageUploadState> {
    private index;
    constructor(props: ConfigImageUploadProps);
    componentDidMount(): void;
    _getUrl(update?: boolean): string;
    loadImage(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigImageUpload;
