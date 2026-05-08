import { type JSX } from 'react';
import type { ConfigItemImageSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigImageSendToProps extends ConfigGenericProps {
    schema: ConfigItemImageSendTo;
}
interface ConfigImageSendToState extends ConfigGenericState {
    image?: string;
}
declare class ConfigImageSendTo extends ConfigGeneric<ConfigImageSendToProps, ConfigImageSendToState> {
    private initialized;
    private localContext;
    componentDidMount(): void;
    askInstance(): void;
    getContext(): string;
    renderItem(): JSX.Element;
}
export default ConfigImageSendTo;
