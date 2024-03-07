export function pannable(node) {
	let x;
	let y;

	function handlePointerdown(event) {
		if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
		x = event.clientX;
		y = event.clientY;
		const target = event.target;

		node.dispatchEvent(
			new CustomEvent('panstart', {
				detail: { x, y, target }
			})
		);

		window.addEventListener('pointermove', handlePointermove);
		window.addEventListener('pointerup', handlePointerup);
	}

	function handlePointermove(event) {
		if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
		const dx = event.clientX - x;
		const dy = event.clientY - y;
		x = event.clientX;
		y = event.clientY;

		node.dispatchEvent(
			new CustomEvent('panmove', {
				detail: { x, y, dx, dy }
			})
		);
	}

	function handlePointerup(event) {
		if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
		x = event.clientX;
		y = event.clientY;

		node.dispatchEvent(
			new CustomEvent('panend', {
				detail: { x, y }
			})
		);
		window.removeEventListener('pointermove', handlePointermove);
		window.removeEventListener('pointerup', handlePointerup);
	}

	function handleTouchStart(event) {
		if (event.touches.length > 1) return;
		const touch = event.touches[0];
		x = touch.clientX;
		y = touch.clientY;
		const target = touch.target;

		node.dispatchEvent(
			new CustomEvent('panstart', {
				detail: { x, y, target }
			})
		);

		window.addEventListener('touchmove', handleTouchmove, { passive: false });
		window.addEventListener('touchend', handleTouchend);
	}

	function handleTouchmove(event) {
		event.preventDefault();
		if (event.touches.length > 1) return;
		const touch = event.touches[0];
		const dx = touch.clientX - x;
		const dy = touch.clientY - y;
		x = touch.clientX;
		y = touch.clientY;

		node.dispatchEvent(
			new CustomEvent('panmove', {
				detail: { x, y, dx, dy }
			})
		);
	}

	function handleTouchend(event) {
		const touch = event.changedTouches[0];
		x = touch.clientX;
		y = touch.clientY;

		node.dispatchEvent(
			new CustomEvent('panend', {
				detail: { x, y }
			})
		);
		window.removeEventListener('touchmove', handleTouchmove);
		window.removeEventListener('touchend', handleTouchend);
	}

	node.addEventListener('pointerdown', handlePointerdown);
	node.addEventListener('touchstart', handleTouchStart);

	return {
		destroy() {
			node.removeEventListener('pointerdown', handlePointerdown);
			node.removeEventListener('touchstart', handleTouchStart);
		}
	};
}
