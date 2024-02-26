/** @typedef {typeof __propDef.props}  TextProps */
/** @typedef {typeof __propDef.events}  TextEvents */
/** @typedef {typeof __propDef.slots}  TextSlots */
export default class Text extends SvelteComponent<{
    x: any;
    y: any;
    size: any;
    lineHeight: any;
    fontFamily: any;
    lines: any;
    pageScale?: number | undefined;
}, {
    update: CustomEvent<any>;
    selectFont: CustomEvent<any>;
    delete: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type TextProps = typeof __propDef.props;
export type TextEvents = typeof __propDef.events;
export type TextSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        x: any;
        y: any;
        size: any;
        lineHeight: any;
        fontFamily: any;
        lines: any;
        pageScale?: number | undefined;
    };
    events: {
        update: CustomEvent<any>;
        selectFont: CustomEvent<any>;
        delete: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
