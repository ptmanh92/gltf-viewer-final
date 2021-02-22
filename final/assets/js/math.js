/*=============================== MATHEMATICS =============================*/
class CustomMath {
    constructor() {}

    vector3 = {
        create: function() {
            return new [0, 0, 0];
        }
    }

    vector4 = {
        create: function() {
            return new [0, 0, 0, 0];
        }
    }

    camera = {
        perspective: function(fov_radian, aspect, near, far) {
            var zoom = 1 / Math.tan(0.5 * fov_radian);
         
            return [
                zoom / aspect, 0, 0, 0,
                0, zoom, 0, 0,
                0, 0, (near + far) / (near - far), -1,
                0, 0, 2 * near * far / (near - far), 0
            ];
        },
    
        orthographic: function(horizontal, vertical, near, far) {
            return [
                1 / horizontal, 0, 0, 0,
                0, 1 / vertical, 0, 0,
                0, 0, 2 / (near - far), 0,
                0, 0, (near + far) / (near - far), 1
            ];
        },
    }

    matrix4 = {
        create: function() {
            return [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]
        },
    
        multiply: function(a, b) {
            return [
                b[0] * a[0] + b[1] * a[4] + b[2] * a[8] + b[3] * a[12],
                b[0] * a[1] + b[1] * a[5] + b[2] * a[9] + b[3] * a[13],
                b[0] * a[2] + b[1] * a[6] + b[2] * a[10] + b[3] * a[14],
                b[0] * a[3] + b[1] * a[7] + b[2] * a[11] + b[3] * a[15],
                b[4] * a[0] + b[5] * a[4] + b[6] * a[8] + b[7] * a[12],
                b[4] * a[1] + b[5] * a[5] + b[6] * a[9] + b[7] * a[13],
                b[4] * a[2] + b[5] * a[6] + b[6] * a[10] + b[7] * a[14],
                b[4] * a[3] + b[5] * a[7] + b[6] * a[11] + b[7] * a[15],
                b[8] * a[0] + b[9] * a[4] + b[10] * a[8] + b[11] * a[12],
                b[8] * a[1] + b[9] * a[5] + b[10] * a[9] + b[11] * a[13],
                b[8] * a[2] + b[9] * a[6] + b[10] * a[10] + b[11] * a[14],
                b[8] * a[3] + b[9] * a[7] + b[10] * a[11] + b[11] * a[15],
                b[12] * a[0] + b[13] * a[4] + b[14] * a[8] + b[15] * a[12],
                b[12] * a[1] + b[13] * a[5] + b[14] * a[9] + b[15] * a[13],
                b[12] * a[2] + b[13] * a[6] + b[14] * a[10] + b[15] * a[14],
                b[12] * a[3] + b[13] * a[7] + b[14] * a[11] + b[15] * a[15],
            ];
        },

        copy: function(b, a) {
            b[0] = a[0];
            b[1] = a[1];
            b[2] = a[2];
            b[3] = a[3];
            b[4] = a[4];
            b[5] = a[5];
            b[6] = a[6];
            b[7] = a[7];
            b[8] = a[8];
            b[9] = a[9];
            b[10] = a[10];
            b[11] = a[11];
            b[12] = a[12];
            b[13] = a[13];
            b[14] = a[14];
            b[15] = a[15];
            return b;
        },
    
        translate: function(m, t_x, t_y, t_z) {
            var delta = [
                1,  0,  0,  0,
                0,  1,  0,  0,
                0,  0,  1,  0,
                t_x, t_y, t_z, 1,
            ];
            return this.multiply(m, delta);
        },
    
        rotate_x: function(m, angle_radian) {
            
            let cos = Math.cos(angle_radian);
            let sin = Math.sin(angle_radian);
    
            var delta = [
                1, 0, 0, 0,
                0, cos, sin, 0,
                0, -sin, cos, 0,
                0, 0, 0, 1,
            ];
            return this.multiply(m, delta);
        },
    
        rotate_y: function(m, angle_radian) {
            let cos = Math.cos(angle_radian);
            let sin = Math.sin(angle_radian);
    
            var delta = [
                cos, 0, -sin, 0,
                0, 1, 0, 0,
                sin, 0, cos, 0,
                0, 0, 0, 1,
            ];
            return this.multiply(m, delta);
        },
    
        rotate_z: function(m, angle_radian) {
            let cos = Math.cos(angle_radian);
            let sin = Math.sin(angle_radian);
    
            var delta = [
                cos, sin, 0, 0,
                -sin, cos, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ];
            return this.multiply(m, delta);
        },
    
        scale: function(m, s_x, s_y, s_z) {
            var delta = [
                s_x, 0,  0,  0,
                0, s_y,  0,  0,
                0,  0, s_z,  0,
                0,  0,  0,  1,
            ];
            return this.multiply(m, delta);
        },

        get_translation: function(m) {
            return [m[12], m[13], m[14]]
        },

        get_scale: function(m) {
            return [
                Math.hypot(m[0], m[1], m[2]),
                Math.hypot(m[4], m[5], m[6]),
                Math.hypot(m[8], m[9], m[10])
            ]
        }
    }

    nice_radian_to_degree(radian) {
        let degree = Math.round(radian * 180 / Math.PI);
        // if (degree > 360) degree = 360
        // if (degree < -360) degree = -360
        if (degree > 360) degree -= 720;
        if (degree < -360) degree += 720;
        if (degree > 360) degree -= 720;
        if (degree < -360) degree += 720;
        return degree;
    }

    radian_to_degree(radian) {
        return radian * 180 / Math.PI;
    }

    degree_to_radian(degree) {
        return degree * Math.PI / 180;
    }
}