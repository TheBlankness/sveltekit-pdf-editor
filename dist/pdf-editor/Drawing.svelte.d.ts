/** @typedef {typeof __propDef.props}  DrawingProps */
/** @typedef {typeof __propDef.events}  DrawingEvents */
/** @typedef {typeof __propDef.slots}  DrawingSlots */
export default class Drawing extends SvelteComponent<{
    x: any;
    y: any;
    width: any;
    path: any;
    originWidth: any;
    originHeight: any;
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
        x: any;
        y: any;
        width: any;
        path: any;
        originWidth: any;
        originHeight: any;
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
