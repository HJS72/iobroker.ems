import React from 'react';
import ConfigGeneric from './ConfigGeneric';
class ConfigStaticImage extends ConfigGeneric {
    renderItem( /* error: string, disabled: boolean, defaultValue */) {
        let src = this.props.schema.src;
        if (src &&
            !src.startsWith('.') &&
            !src.startsWith('http') &&
            !src.startsWith(`adapter/${this.props.oContext.adapterName}/`) &&
            !src.startsWith(`./adapter/${this.props.oContext.adapterName}/`)) {
            src = `adapter/${this.props.oContext.adapterName}/${src}`;
        }
        return (React.createElement("img", { src: src, style: { cursor: this.props.schema.href ? 'pointer' : undefined, width: '100%', height: '100%' }, onClick: this.props.schema.href
                ? () => this.props.schema.href && window.open(this.props.schema.href, '_blank')
                : null, alt: "" }));
    }
}
export default ConfigStaticImage;
//# sourceMappingURL=ConfigStaticImage.js.map