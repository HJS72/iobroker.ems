import { type JSX } from 'react';
import type { ConfigItemInfoBox } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInfoBoxProps extends ConfigGenericProps {
    schema: ConfigItemInfoBox;
}
export default class ConfigInfoBox extends ConfigGeneric<ConfigInfoBoxProps, ConfigGenericState> {
    renderItem(): JSX.Element;
}
export {};
