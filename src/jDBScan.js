/* 
 Author: Corneliu S. (github.com/upphiminn)
 2013
 */

const jDBSCAN = function() {
	// local instance vars.
	let eps;
	let time_eps;
	let minPts;
	let data = [];
	let clusters = [];
	let status = [];
	let graph = [];
	let distance = euclidean_distance;
	let time_distance = timestamp_distance;
	
	// utils
	function array_min(array, f) {
		let i = -1;
		let n = array.length;
		let a;
		let b;

		if (arguments.length === 1) {
			while (++i < n && !((a = array[i]) != null && a <= a)) a = undefined;
			while (++i < n) if ((b = array[i]) != null && a > b) a = b;
		} else {
			while (++i < n && !((a = f.call(array, array[i], i)) != null && a <= a)) a = undefined;
			while (++i < n) if ((b = f.call(array, array[i], i)) != null && a > b) a = b;
		}

		return a;
	}

	function array_max(array, f) {
		let i = -1;
		let n = array.length;
		let a;
		let b;

		if (arguments.length === 1) {
			while (++i < n && !((a = array[i]) != null && a <= a)) a = undefined;
			while (++i < n) if ((b = array[i]) != null && b > a) a = b;
		} else {
			while (++i < n && !((a = f.call(array, array[i], i)) != null && a <= a)) a = undefined;
			while (++i < n) if ((b = f.call(array, array[i], i)) != null && b > a) a = b;
		}

		return a;
	}

	// distance functions
	function timestamp_distance(point1, point2) {
		return Math.abs(point2.timestamp - point1.timestamp);
	}

	function euclidean_distance(point1, point2) {
		return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
	}

	function manhattan_distance(point1, point2) {
		return Math.abs(point2.x - point1.x) + Math.abs(point2.y - point1.y);
	}

	function haversine_distance(point1, point2) {
		const R = 6371;
		const precision = 4; // default 4 sig figs reflects typical 0.3% accuracy of spherical model
		const lat1 = (point1.location.latitude * Math.PI) / 180;
		const lon1 = (point1.location.longitude * Math.PI) / 180;
		const lat2 = (point2.location.latitude * Math.PI) / 180;
		const lon2 = (point2.location.longitude * Math.PI) / 180;
		const dLat = lat2 - lat1;
		const dLon = lon2 - lon1;

		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const d = R * c;
		
		return d.toPrecision(precision); 
	}

	// core algorithm related
	function get_region_neighbours(point_idx) {
		const neighbours = [];
		let d = data[point_idx];

		for (let i = 0; i < data.length; i++) {
			if (point_idx === i) {
				continue;
			}

			if (time_eps && time_distance(data[i], d) <= time_eps && distance(data[i], d) <= eps) {
				neighbours.push(i);
			} else if (distance(data[i], d) <= eps) {
				neighbours.push(i);
			}
		}

		return neighbours;
	}

	function expand_cluster(point_idx, neighbours, cluster_idx) {
		clusters[cluster_idx - 1].push(point_idx); // add point to cluster
		status[point_idx] = cluster_idx; // assign cluster id

		for (let i = 0; i < neighbours.length; i++) {
			const curr_point_idx = neighbours[i];

			if (status[curr_point_idx] === undefined) {
				status[curr_point_idx] = 0; // visited and marked as noise by default
				let curr_neighbours = get_region_neighbours(curr_point_idx);
				let curr_num_neighbours = curr_neighbours.length;

				if (curr_num_neighbours >= minPts) {
					expand_cluster(curr_point_idx, curr_neighbours, cluster_idx);
				}
			}

			if (status[curr_point_idx] < 1) {
				// not assigned to a cluster but visited (= 0)
				status[curr_point_idx] = cluster_idx;
				clusters[cluster_idx - 1].push(curr_point_idx);
			}
		}
	}

	let dbscan = function() {
		status = [];
		clusters = [];

		for (let i = 0; i < data.length; i++) {
			if (status[i] === undefined) {
				status[i] = 0; // visited and marked as noise by default
				const neighbours = get_region_neighbours(i);
				const num_neighbours = neighbours.length;

				if (num_neighbours < minPts) {
					status[i] = 0; // noise
				} else {
					clusters.push([]); // empty new cluster
					const cluster_idx = clusters.length;
					expand_cluster(i, neighbours, cluster_idx);
				}
			}
		}

		return status;
	};

	// resulting clusters center points
	dbscan.getClusters = function() {
		const num_clusters = clusters.length;
		const clusters_centers = [];

		for (let i = 0; i < num_clusters; i++) {
			if (distance === euclidean_distance || distance === manhattan_distance) {
				clusters_centers[i] = { x: 0, y: 0 };

				for (let j = 0; j < clusters[i].length; j++) {
					clusters_centers[i].x += data[clusters[i][j]].x;
					clusters_centers[i].y += data[clusters[i][j]].y;
				}

				clusters_centers[i].x /= clusters[i].length;
				clusters_centers[i].y /= clusters[i].length;
				clusters_centers[i].dimension = clusters[i].length;
				clusters_centers[i].parts = clusters[i];
			}

			if (distance === haversine_distance) {
				clusters_centers[i] = { location: { latitude: 0, longitude: 0, accuracy: 0 } };

				for (let j = 0; j < clusters[i].length; j++) {
					clusters_centers[i].location.latitude += data[clusters[i][j]].location.latitude;
					clusters_centers[i].location.longitude += data[clusters[i][j]].location.longitude;
					clusters_centers[i].location.accuracy += data[clusters[i][j]].location.accuracy;
				}

				clusters_centers[i].dimension = clusters[i].length;
				clusters_centers[i].parts = clusters[i];
				clusters_centers[i].location.latitude /= clusters[i].length;
				clusters_centers[i].location.longitude /= clusters[i].length;
				clusters_centers[i].location.accuracy /= clusters[i].length;
			}

			if (time_eps) {
				clusters_centers[i].duration = {};
				clusters_centers[i].duration.start = array_min(clusters[i], function(d) {
					return data[d].timestamp;
				});
				clusters_centers[i].duration.end = array_max(clusters[i], function(d) {
					return data[d].timestamp;
				});
				clusters_centers[i].duration.span =
					clusters_centers[i].duration.end - clusters_centers[i].duration.start;
			}
		}

		return clusters_centers;
	};

	// getters and setters
	dbscan.data = function(d) {
		if (arguments.length === 0) {
			return data;
		}

		if (Array.isArray(d)) {
			data = d;
		}

		return dbscan;
	};

	dbscan.eps = function(e) {
		if (arguments.length === 0) {
			return eps;
		}

		if (typeof e === 'number') {
			eps = e;
		}

		return dbscan;
	};

	dbscan.timeEps = function(e) {
		if (arguments.length === 0) {
			return time_eps;
		}

		if (typeof e === 'number') {
			time_eps = e;
		}

		return dbscan;
	};

	dbscan.minPts = function(p) {
		if (arguments.length === 0) {
			return minPts;
		}

		if (typeof p === 'number') {
			minPts = p;
		}

		return dbscan;
	};

	dbscan.distance = function(fn) {
		if (arguments.length === 1) {
			if (typeof fn === 'string') {
				switch (fn) {
					case 'HAVERSINE':
						distance = haversine_distance;
						break;
					case 'EUCLIDEAN':
						distance = euclidean_distance;
						break;
					case 'MANHATTAN':
						distance = manhattan_distance;
						break;
					default:
						distance = euclidean_distance;
				}
			} else if (typeof fn === 'function') {
				distance = fn;
			}
		}

		return dbscan;
	};

	dbscan.timeDistance = function(fn) {
		if (arguments.length === 1) {
			time_distance = fn;
		}

		return dbscan;
	};

	return dbscan;
};

(function(root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory();
	} else {
		// Browser globals (root is window)
		root.jDBSCAN = factory();
	}
})(typeof self !== 'undefined' ? self : this, function() {
	// Just return a value to define the module export.
	// This example returns an object, but the module
	// can return a function as the exported value.
	return jDBSCAN;
});
