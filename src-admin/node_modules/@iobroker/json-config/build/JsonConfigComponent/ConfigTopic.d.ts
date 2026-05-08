import { type JSX } from 'react';
import type { ConfigItemTopic } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigTopicProps extends ConfigGenericProps {
    schema: ConfigItemTopic;
}
declare class ConfigTopic extends ConfigGeneric<ConfigTopicProps, ConfigGenericState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigTopic;
