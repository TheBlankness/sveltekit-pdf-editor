export type CameraRedrawGateState = {
	isDrawingStroke: boolean;
	isPanning: boolean;
	isMomentumScrolling: boolean;
	hasGesture: boolean;
};

export function canReleaseCameraRedraw(state: CameraRedrawGateState) {
	return (
		!state.isDrawingStroke &&
		!state.isPanning &&
		!state.isMomentumScrolling &&
		!state.hasGesture
	);
}
