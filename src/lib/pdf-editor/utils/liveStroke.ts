export type StrokeCommand = ['M' | 'L', number, number];

type RenderPath = (path: string) => void;
export type StrokeRenderRange = {
	from: number;
	reset?: boolean;
};
type RenderCommands = (commands: readonly StrokeCommand[], range: StrokeRenderRange) => void;

type LiveStrokeOptions = {
	minPointDistance?: number;
	maxPointsPerSegment?: number;
	renderCommands?: RenderCommands;
};

const DEFAULT_MIN_POINT_DISTANCE = 0.85;
const DEFAULT_MAX_POINTS_PER_SEGMENT = 600;

function clampCanvasCoordinate(value: number, max: number) {
	return Math.max(0, Math.min(value, max));
}

function roundToTwoDecimals(value: number) {
	const rounded = Math.round(value * 100) / 100;
	return Object.is(rounded, -0) ? 0 : rounded;
}

export function getCoalescedPointerEvents(event: PointerEvent): PointerEvent[] {
	if (isIOSLikeDevice()) return [event];
	if (typeof event.getCoalescedEvents !== 'function') return [event];

	const events = event.getCoalescedEvents();
	return events.length > 0 ? events : [event];
}

export function isIOSLikeDevice() {
	if (typeof navigator === 'undefined') return false;

	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

export function isPenLikePointerEvent(event: PointerEvent) {
	if (event.pointerType === 'pen') return true;
	if (event.pointerType === 'mouse' || event.pointerType === 'touch') return false;

	const pressure = Number(event.pressure);
	return pressure > 0 && pressure !== 0.5;
}

export function commandsToPath(commands: StrokeCommand[]) {
	return commands.map(([command, x, y]) => `${command}${x},${y}`).join('');
}

export class LiveStroke {
	private canvasRect: DOMRect | null = null;
	private renderFrame: number | null = null;
	private commands: StrokeCommand[] = [];
	private lastPoint: { x: number; y: number } | null = null;
	private minPointDistance: number;
	private maxPointsPerSegment: number;
	private segmentPointCount = 0;
	private dirtyFrom: number | null = null;
	private renderCommands?: RenderCommands;

	constructor(
		private getCanvas: () => HTMLElement | undefined,
		private renderPath: RenderPath,
		options: LiveStrokeOptions = {}
	) {
		this.minPointDistance = Math.max(0, options.minPointDistance ?? DEFAULT_MIN_POINT_DISTANCE);
		this.maxPointsPerSegment = Math.max(
			8,
			options.maxPointsPerSegment ?? DEFAULT_MAX_POINTS_PER_SEGMENT
		);
		this.renderCommands = options.renderCommands;
	}

	start(clientX: number, clientY: number, target: EventTarget | null) {
		const canvas = this.getCanvas();
		if (!canvas) return false;
		if (
			typeof Node !== 'undefined' &&
			target instanceof Node &&
			target !== canvas &&
			!canvas.contains(target)
		) {
			return false;
		}

		this.reset(false);
		this.canvasRect = canvas.getBoundingClientRect();

		const point = this.getCanvasPoint(clientX, clientY);
		this.addPoint('M', point.x, point.y);
		this.addPoint('L', point.x, point.y);
		this.scheduleRender();

		return true;
	}

	addClientPoint(clientX: number, clientY: number) {
		if (!this.canvasRect) return;

		const point = this.getCanvasPoint(clientX, clientY);
		this.addPoint('L', point.x, point.y);
		this.scheduleRender();
	}

	addPointerEvent(event: PointerEvent) {
		for (const coalescedEvent of getCoalescedPointerEvents(event)) {
			this.addClientPoint(coalescedEvent.clientX, coalescedEvent.clientY);
		}
	}

	finish(pageScale: number, roundCoordinates = false) {
		const canvasRect = this.canvasRect || this.getCanvas()?.getBoundingClientRect();
		if (!canvasRect || this.commands.length === 0) return null;

		const normalize = roundCoordinates ? roundToTwoDecimals : (value: number) => value;
		const scaledCommands = this.commands.map(
			([command, x, y]) =>
				[command, normalize(x / pageScale), normalize(y / pageScale)] as StrokeCommand
		);

		return {
			originWidth: normalize(canvasRect.width / pageScale),
			originHeight: normalize(canvasRect.height / pageScale),
			path: commandsToPath(scaledCommands),
			commands: scaledCommands
		};
	}

	reset(renderEmpty = true) {
		if (this.renderFrame !== null) {
			cancelAnimationFrame(this.renderFrame);
			this.renderFrame = null;
		}

		this.canvasRect = null;
		this.commands = [];
		this.lastPoint = null;
		this.segmentPointCount = 0;
		this.dirtyFrom = null;

		if (renderEmpty) {
			this.renderPath('');
			this.renderCommands?.(this.commands, { from: 0, reset: true });
		}
	}

	get length() {
		return this.commands.length;
	}

	private getCanvasPoint(clientX: number, clientY: number) {
		const rect = this.canvasRect;
		if (!rect) return { x: 0, y: 0 };

		return {
			x: clampCanvasCoordinate(clientX - rect.left, rect.width),
			y: clampCanvasCoordinate(clientY - rect.top, rect.height)
		};
	}

	private addPoint(command: 'M' | 'L', x: number, y: number) {
		const roundedX = roundToTwoDecimals(x);
		const roundedY = roundToTwoDecimals(y);

		if (command === 'L' && this.commands.length > 2 && this.lastPoint) {
			const dx = roundedX - this.lastPoint.x;
			const dy = roundedY - this.lastPoint.y;
			if (dx * dx + dy * dy < this.minPointDistance * this.minPointDistance) {
				return;
			}
		}

		if (
			command === 'L' &&
			this.segmentPointCount >= this.maxPointsPerSegment &&
			this.lastPoint
		) {
			this.pushCommand('M', this.lastPoint.x, this.lastPoint.y);
		}

		this.pushCommand(command, roundedX, roundedY);
	}

	private pushCommand(command: 'M' | 'L', x: number, y: number) {
		if (this.dirtyFrom === null) {
			this.dirtyFrom = Math.max(0, this.commands.length - 1);
		}

		this.commands.push([command, x, y]);
		this.lastPoint = { x, y };
		this.segmentPointCount = command === 'M' ? 1 : this.segmentPointCount + 1;
	}

	private scheduleRender() {
		if (this.renderFrame !== null) return;

		const render = () => {
			this.renderFrame = null;
			const from = this.dirtyFrom ?? 0;
			this.dirtyFrom = null;
			this.renderCommands?.(this.commands, { from });
			if (!this.renderCommands) {
				this.renderPath(commandsToPath(this.commands));
			}
		};

		if (typeof requestAnimationFrame === 'undefined') {
			render();
			return;
		}

		this.renderFrame = requestAnimationFrame(render);
	}
}
