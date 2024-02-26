/** @typedef {typeof __propDef.props}  DrawingProps */
/** @typedef {typeof __propDef.events}  DrawingEvents */
/** @typedef {typeof __propDef.slots}  DrawingSlots */
export default class Drawing extends SvelteComponent<{
    originWidth: any;
    originHeight: any;
    width: any;
    x: any;
    y: any;
    path: any;
    brushSize: any;
    brushColor: any;
    pageScale?: number | undefined;
}, {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type DrawingProps = typeof __propDef.props;
export type DrawingEvents = typeof __propDef.events;
export type DrawingSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        originWidth: any;
        originHeight: any;
        width: any;
        x: any;
        y: any;
        path: any;
        brushSize: any;
        brushColor: any;
        pageScale?: number | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
