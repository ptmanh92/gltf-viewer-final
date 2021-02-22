/*============================ INITIALIZATION =============================*/
// Prepare canvas
var canvas = document.getElementById('my_canvas');
canvas.width = document.getElementById('canvas_container').scrollWidth;
canvas.height = window.innerHeight;
var gl = canvas.getContext('webgl2', { antialias: true });
if (!gl) {
    console.log("Web-browser does not support WebGL 2");
} else {
    webgl_settings(gl);
}

// Create default sampler for texture
var default_Sampler = gl.createSampler();
gl.samplerParameteri(default_Sampler, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
gl.samplerParameteri(default_Sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.samplerParameteri(default_Sampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.samplerParameteri(default_Sampler, gl.TEXTURE_WRAP_T, gl.REPEAT);

// Prepare GUI
document.getElementById('options').style.maxHeight = window.innerHeight + "px";
gui_settings();


/*=============================== SETTING UP ==============================*/
// Setup program
const draw = async (update) => {
    // console.log("=> Start drawing...")

    if (!update) {
        show_spinner(true, true, "Loading model...");

        if (draw_mode == MODE.learn) {
            // Load image (for texture)
            if (learn_model == 2) {
                image = load_image();
            }
            var a_position, a_color, a_texture_coord, image;

            // Load shader-scripts from glsl files
            var vertex_script = await fetch("assets/shaders/" + basic_examples[learn_model].vertexscript).then(e => e.text());
            var fragment_script = await fetch("assets/shaders/" + basic_examples[learn_model].fragmentscript).then(e => e.text());

            // Link shaders with program & use program
            program = createProgram(gl, vertex_script, fragment_script);
            gl.useProgram(program);

            // Look up vertex inputs
            a_position = basic_examples[learn_model].vertex_attributes.position ? gl.getAttribLocation(program, 'a_position') : null;
            a_color = basic_examples[learn_model].vertex_attributes.color ? gl.getAttribLocation(program, 'a_color') : null;
            a_texture_coord = basic_examples[learn_model].vertex_attributes.texture_coord ? gl.getAttribLocation(program, 'a_texture_coord') : null;

            // Current vertex array object
            var current_vertex_array = gl.createVertexArray();
            gl.bindVertexArray(current_vertex_array);
            
            // Enable attributes
            if (a_position !== null) gl.enableVertexAttribArray(a_position);
            if (a_color !== null) gl.enableVertexAttribArray(a_color);
            if (a_texture_coord !== null) gl.enableVertexAttribArray(a_texture_coord);

            // Prepare data
            var vertices_object = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertices_object);
            if (a_position !== null) create_vertices(a_position, a_texture_coord);
            if (a_color !== null) create_colors(a_color);

            // Create textures
            if (a_texture_coord !== null) {
                var texture = gl.createTexture();
                gl.activeTexture(gl.TEXTURE0 + 0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
            
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            
                var mipLevel = 0;               // the largest mip
                var internalFormat = gl.RGBA;   // format we want in the texture
                var srcFormat = gl.RGBA;        // format of data we are supplying
                var srcType = gl.UNSIGNED_BYTE; // type of data we are supplying
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    mipLevel,
                    internalFormat,
                    srcFormat,
                    srcType,
                    image
                );

                // create_textures(image);
                gl.bindVertexArray(current_vertex_array);
                gl.bindBuffer(gl.ARRAY_BUFFER, vertices_object);
                create_image_buffer(image);
            }
        } else if (draw_mode == MODE.zip) {
            var ATTRIB_LOCATION = {
                POSITION: 0,
                TEXCOORD_0: 1
            }

            // First load shader scripts
            var vertex_script = await fetch("assets/shaders/vertexscript.glsl").then(e => e.text());
            var fragment_script = await fetch("assets/shaders/fragmentscript.glsl").then(e => e.text());

            // Working with buffer data
            for (let bufferView of GLTF_FILE.value.bufferViews) {
                current_bufferView = bufferView;
                current_bufferView.new_buffer = gl.createBuffer();

                if (bufferView.target !== null) {
                    gl.bindBuffer(current_bufferView.target, current_bufferView.new_buffer);
                    gl.bufferData(current_bufferView.target, current_bufferView.data, gl.STATIC_DRAW);
                    gl.bindBuffer(current_bufferView.target, null)
                }
            }

            // Working with textures (if exists)
            if (GLTF_FILE.value.textures !== undefined) {
                for (let texture of GLTF_FILE.value.textures) {
                    texture.data = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture.data);
                    var texture_source = GLTF_FILE.value.images[texture.source].data;
                    // console.log(texture_source);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture_source);
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
            }

            // Working with samplers (if exists)
            if (GLTF_FILE.value.samplers !== undefined) {
                for (let sampler of GLTF_FILE.value.samplers) {
                    sampler.data = gl.createSampler();

                    if (sampler.minFilter !== null) gl.samplerParameteri(sampler.data, gl.TEXTURE_MIN_FILTER, sampler.minFilter);
                    else gl.samplerParameteri(sampler.data, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
                    
                    if (sampler.magFilter) gl.samplerParameteri(sampler.data, gl.TEXTURE_MAG_FILTER, sampler.magFilter);
                    else gl.samplerParameteri(sampler.data, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                    gl.samplerParameteri(sampler.data, gl.TEXTURE_WRAP_S, sampler.wrapS);
                    gl.samplerParameteri(sampler.data, gl.TEXTURE_WRAP_T, sampler.wrapT);
                }
            }

            // Working with meshes
            if (GLTF_FILE.value.meshes !== undefined) {
                for (let mesh of GLTF_FILE.value.meshes) {
                    for (let primitive of mesh.primitives) {
                        // Set Current vertex array object
                        primitive.vao = gl.createVertexArray();
                        gl.bindVertexArray(primitive.vao);

                        // Load attributes POSITION & TEXCOORD_0
                        for (let attr in primitive.attributes) {
                            if (ATTRIB_LOCATION.hasOwnProperty(attr)) {
                                let new_accessor = GLTF_FILE.value.accessors[primitive.attributes[attr]];
                                let new_bufferview = GLTF_FILE.value.bufferViews[new_accessor.bufferView];

                                let new_buff = gl.createBuffer();
                                if (new_bufferview.target !== null) {
                                    gl.bindBuffer(new_bufferview.target, new_buff);
                                } else {
                                    gl.bindBuffer(gl.ARRAY_BUFFER, new_buff);
                                    gl.bufferData(gl.ARRAY_BUFFER, new_bufferview.data, gl.STATIC_DRAW);
                                }

                                gl.vertexAttribPointer(
                                    ATTRIB_LOCATION[attr],
                                    new_accessor.size,
                                    new_accessor.componentType,
                                    new_accessor.normalized,
                                    new_accessor.byteStride || 0,
                                    new_accessor.byteOffset
                                );
                                gl.enableVertexAttribArray(ATTRIB_LOCATION[attr]);
                            }
                        }

                        // If vertices to be drawn using indices
                        if (primitive.indices !== null) {
                            current_accessor = GLTF_FILE.value.accessors[primitive.indices];
                            current_bufferview = GLTF_FILE.value.bufferViews[current_accessor.bufferView];

                            // let new_buff = gl.createBuffer();
                            if (current_bufferview.target !== null) {
                                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, current_bufferview.new_buffer);
                            } else {
                                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, current_bufferview.new_buffer);
                                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, current_bufferview.data, gl.STATIC_DRAW);
                            }
                        }

                        // Un-bind everythings
                        gl.bindVertexArray(null);
                        gl.bindBuffer(gl.ARRAY_BUFFER, null);
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

                        // Prepare fragment shader script according to material
                        var new_fragment_script = '#version 300 es\n';
                        var fragment_uniforms = {
                            fragment: "",
                            static: false,
                            bc_factor: true,
                            bc_texture: false,
                            occlusion: false,
                            emissive: false,
                        }

                        if (primitive.material !== null) {
                            let new_material = GLTF_FILE.value.materials[primitive.material];
                            // Let user decides which channel should be used
                            fragment_uniforms = generate_fs_material(parseInt(color_channel.value), new_material);
                        }
                        new_fragment_script += fragment_uniforms.fragment + fragment_script;
                        

                        // Load shaders with the new scripts & use program
                        program = createProgram(gl, vertex_script, new_fragment_script);
                        gl.useProgram(program);


                        // Setup uniforms for the baseColor
                        primitive.program = program;
                        primitive.uniforms = {}
                        if (fragment_uniforms.static) {
                            // Set uniform static color
                            primitive.uniforms.staticColor = gl.getUniformLocation(program, 'u_staticColor');
                        } else {
                            // Set uniform base color
                            if (fragment_uniforms.bc_factor) primitive.uniforms.baseColorFactor = gl.getUniformLocation(program, 'u_baseColorFactor');
                            if (fragment_uniforms.bc_texture) primitive.uniforms.baseColorTexture = gl.getUniformLocation(program, 'u_baseColorTexture');
                            // Set uniform occlusion
                            if (fragment_uniforms.occlusion) {
                                primitive.uniforms.occlusionTexture = gl.getUniformLocation(program, 'u_occlusionTexture');
                                primitive.uniforms.occlusionStrength = gl.getUniformLocation(program, 'u_occlusionStrength');
                            }
                            // Set uniform emissive
                            if (fragment_uniforms.emissive) {
                                primitive.uniforms.emissiveTexture = gl.getUniformLocation(program, 'u_emissiveTexture');
                                primitive.uniforms.emissiveFactor = gl.getUniformLocation(program, 'u_emissiveFactor');
                            }
                        }
                        primitive.uniforms.final_transformation = gl.getUniformLocation(program, "u_transformation");


                        // Turn off program
                        gl.useProgram(null);
                    }
                }
            }
        }
        show_spinner(false);
    }

    // console.log("=> Start rendering...")
    render();
}

/*=============================== RENDERER ================================*/
const render = (time) => {
    // Clearing screen
    let bkgr_color = settings.background_color;
    gl.clearColor(bkgr_color[0], bkgr_color[1], bkgr_color[2], bkgr_color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Using cameras
    // Perspective
    if (current_cam.type == "perspective") {
        let yfov = current_cam.yfov;
        let aspect = current_cam.aspectRatio;
        let znear = current_cam.znear;
        let zfar = current_cam.zfar;
        trans_matrix = MATH.camera.perspective(yfov, aspect, znear, zfar);
    }
    // Orthographic
    if (current_cam.type == "orthographic") {
        let xmag = current_cam.xmag;
        let ymag = current_cam.ymag;
        let znear = current_cam.znear;
        let zfar = current_cam.zfar;
        trans_matrix = MATH.camera.orthographic(xmag, ymag, znear, zfar);
    }
    // Set camera position
    let cam_x = settings.cameras.position.x;
    let cam_y = settings.cameras.position.y;
    let cam_z = settings.cameras.position.z;
    trans_matrix = MATH.matrix4.translate(trans_matrix, cam_x, cam_y, cam_z);

    // Getting transformations (translation + rotation + scale)
    trans_matrix = MATH.matrix4.translate(trans_matrix, get_trans("translation", "x"), get_trans("translation", "y"), get_trans("translation", "z"))
    trans_matrix = MATH.matrix4.rotate_x(trans_matrix, get_trans("rotation", "x"));
    trans_matrix = MATH.matrix4.rotate_y(trans_matrix, get_trans("rotation", "y"));
    trans_matrix = MATH.matrix4.rotate_z(trans_matrix, get_trans("rotation", "z"));
    trans_matrix = MATH.matrix4.scale(trans_matrix, get_trans("scale", "x"), get_trans("scale", "y"), get_trans("scale", "z"));
    
    if (draw_mode == MODE.learn) {
        // Textures
        var u_image = gl.getUniformLocation(program, 'u_image');
        gl.uniform1i(u_image, 0);

        var u_transformation = gl.getUniformLocation(program, "u_transformation");
        gl.uniformMatrix4fv(u_transformation, gl.FALSE, trans_matrix);

        // Do drawing
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / basic_examples[learn_model].components);
    } else if (draw_mode == MODE.zip) {
        // Do actual drawing
        GLTF.draw_scene(current_scene);
    }

    // requestAnimationFrame(render);
}


/*=============================== FUNCTIONS ===============================*/
const create_vertices = async (a_position, a_texture_coord) => {    
    if (learn_model == 0) {
        console.log("Do triangle...");
        vertices = [
            0.0, 0.3, 0.0,
            -0.3, -0.3, 0.0,
            0.3, -0.3, 0.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_position, basic_examples[learn_model].components, gl.FLOAT, gl.FALSE, 0, 0);
    } else if (learn_model == 1) {
        console.log("Do box...");
        vertices = [
            -0.3, 0.3, -0.3,    // EBF
            0.3, 0.3, 0.3,
            0.3, 0.3, -0.3,
            0.3, 0.3, 0.3,      // BEA
            -0.3, 0.3, -0.3,
            -0.3, 0.3, 0.3,
    
            -0.3, 0.3, -0.3,    // EDA
            -0.3, -0.3, 0.3,
            -0.3, 0.3, 0.3,
            -0.3, -0.3, 0.3,    // DEH
            -0.3, 0.3, -0.3,
            -0.3, -0.3, -0.3,
    
            0.3, 0.3, 0.3,      // BGF
            0.3, -0.3, -0.3,
            0.3, 0.3, -0.3,
            0.3, -0.3, -0.3,    // GBC
            0.3, 0.3, 0.3,
            0.3, -0.3, 0.3,
    
            -0.3, 0.3, 0.3,     // ACB
            0.3, -0.3, 0.3,
            0.3, 0.3, 0.3,
            0.3, -0.3, 0.3,     // CAD
            -0.3, 0.3, 0.3,
            -0.3, -0.3, 0.3,
    
            -0.3, -0.3, -0.3,   // HFG
            0.3, 0.3, -0.3,
            0.3, -0.3, -0.3,
            0.3, 0.3, -0.3,     // FHE
            -0.3, -0.3, -0.3,
            -0.3, 0.3, -0.3,
    
            -0.3, -0.3, 0.3,    // DGC
            0.3, -0.3, -0.3,
            0.3, -0.3, 0.3,
            0.3, -0.3, -0.3,    // GDH
            -0.3, -0.3, 0.3,
            -0.3, -0.3, -0.3
        ]
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_position, basic_examples[learn_model].components, gl.FLOAT, gl.FALSE, 0, 0);
    } else if (learn_model == 2) {
        console.log("Do simple image...")
        gl.vertexAttribPointer(a_position, basic_examples[learn_model].components, gl.FLOAT, gl.FALSE, 0, 0);

        var texture_coord = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texture_coord);

        vertices = [
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0
        ]

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_texture_coord, basic_examples[learn_model].components, gl.FLOAT, gl.FALSE, 0, 0);
    }
}

const create_colors = async (a_color) => {
    var color_vertices = []
    var color_object = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, color_object);
    
    if (learn_model == 0) {
        color_vertices = [
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
        ];
    } else if (learn_model == 1) {
        color_vertices = [
            0.0, 1.0, 0.0,      // EBF - green
            0.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 1.0, 0.0,      // BEA - green
            0.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
    
            0.0, 1.0, 1.0,      // EDA - aqua
            0.0, 1.0, 1.0,
            0.0, 1.0, 1.0,
            0.0, 1.0, 1.0,      // DEH - aqua
            0.0, 1.0, 1.0,
            0.0, 1.0, 1.0,
    
            1.0, 0.0, 1.0,      // BGF - pink
            1.0, 0.0, 1.0,
            1.0, 0.0, 1.0,
            1.0, 0.0, 1.0,      // GBC - pink
            1.0, 0.0, 1.0,
            1.0, 0.0, 1.0,
    
            1.0, 0.0, 0.0,      // ACB - red
            1.0, 0.0, 0.0,
            1.0, 0.0, 0.0,
            1.0, 0.0, 0.0,      // CAD - red
            1.0, 0.0, 0.0,
            1.0, 0.0, 0.0,
    
            0.0, 0.0, 1.0,      // HFG - blue
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,      // FHE - blue
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
    
            1.0, 1.0, 0.0,      // DGC - yellow
            1.0, 1.0, 0.0,
            1.0, 1.0, 0.0,
            1.0, 1.0, 0.0,      // GDH - yellow
            1.0, 1.0, 0.0,
            1.0, 1.0, 0.0
        ]
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(color_vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_color, basic_examples[learn_model].components, gl.FLOAT, gl.FALSE, 0, 0);
}

const create_image_buffer = (image) => {
    let x1 = (gl.canvas.clientWidth - image.width) * 0.5;
    let x2 = x1 + image.width;
    let y1 = (gl.canvas.clientHeight - image.height) * 0.5;
    let y2 = y1 + image.height;

    x1 = convert_to_clip_space(x1, gl.canvas.clientWidth);
    x2 = convert_to_clip_space(x2, gl.canvas.clientWidth);
    y1 = convert_to_clip_space(y1, gl.canvas.clientHeight);
    y2 = convert_to_clip_space(y2, gl.canvas.clientHeight);

    let image_vertices = [
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,
    ]
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(image_vertices), gl.STATIC_DRAW);
}

const create_textures = (image) => {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    var mipLevel = 0;               // the largest mip
    var internalFormat = gl.RGBA;   // format we want in the texture
    var srcFormat = gl.RGBA;        // format of data we are supplying
    var srcType = gl.UNSIGNED_BYTE; // type of data we are supplying
    gl.texImage2D(
        gl.TEXTURE_2D,
        mipLevel,
        internalFormat,
        srcFormat,
        srcType,
        image
    );
}

const convert_to_clip_space = (old_size, original) => {
    return 2 * old_size / original - 1;
}

const load_image = () => {
    var image = new Image();
    let image_index = Math.floor(Math.random() * basic_examples[learn_model].images.length);
    let image_name = basic_examples[learn_model].images[image_index];
    image.src = 'learn/' + image_name;
    image.onload = function (){
        console.log(image);
    }

    return image;
}

const generate_fs_material = (user_choice, m) => {
    let output = {
        fragment: "",
        static: false,
        bc_factor: false,
        bc_texture: false,
        occlusion: false,
        emissive: false,
    }

    switch (user_choice) {
        case 1: // If user set to static color
            output.static = true;
            output.fragment += '#define STATIC_COLOR\n';
            break;
        case 2: // Check for baseColor
            if (m.pbrMetallicRoughness.baseColorFactor !== null && m.pbrMetallicRoughness.baseColorFactor !== undefined) {
                output.bc_factor = true;
            }
            if (m.pbrMetallicRoughness.baseColorTexture !== null && m.pbrMetallicRoughness.baseColorTexture !== undefined) {
                output.bc_texture = true;
                output.fragment += '#define BASECOLOR_TEXTURE\n';
            }
            break;
        case 3: // Check for occlusion
            if (m.occlusionTexture !== null && m.occlusionTexture !== undefined) {
                output.occlusion = true;
                output.fragment += '#define OCCLUSION_TEXTURE\n';
            }
            break;
        case 4: // Check for emissive
            if (m.emissiveTexture !== null && m.emissiveTexture !== undefined) {
                output.emissive = true;
                output.fragment += '#define EMISSIVE_TEXTURE\n';
            }
            break;
        default:
            if (m.pbrMetallicRoughness.baseColorFactor !== null && m.pbrMetallicRoughness.baseColorFactor !== undefined) {
                output.bc_factor = true;
            }
            if (m.pbrMetallicRoughness.baseColorTexture !== null && m.pbrMetallicRoughness.baseColorTexture !== undefined) {
                output.bc_texture = true;
                output.fragment += '#define BASECOLOR_TEXTURE\n';
            }
            if (m.occlusionTexture !== null && m.occlusionTexture !== undefined) {
                output.occlusion = true;
                output.fragment += '#define OCCLUSION_TEXTURE\n';
            }
            if (m.emissiveTexture !== null && m.emissiveTexture !== undefined) {
                output.emissive = true;
                output.fragment += '#define EMISSIVE_TEXTURE\n';
            }
    }

    return output;
}


/*============================= MOUSE ACTIONS =============================*/
var cam_pos_x = document.getElementById('cam_pos_x');
var cam_pos_y = document.getElementById('cam_pos_y');
var mouse_down = false;
var mouse_button, mouse_x, mouse_y;
var last_trans_x, last_trans_y, new_trans_x, new_trans_y;
var last_cam_x, last_cam_y, new_cam_x, new_cam_y;

// Zoom on mouse wheel
canvas.onwheel = function(e) {
    let delta = e.deltaY / -1000;

    for (let coord of settings.transformation.scale.children) {
        coord.value = parseFloat(coord.value) + delta;
        document.getElementById("Scale" + coord.name + "_input").value = coord.value;
    }

    draw(true);
};

// Actions on mouse down
canvas.onmousedown = function(e) {
    mouse_down = true;
    mouse_button = e.which;

    mouse_x = e.clientX;
    mouse_y = e.clientY;

    if (mouse_button == 1) {
        last_trans_x = settings.transformation.rotation.children[0].value;
        last_trans_y = settings.transformation.rotation.children[1].value;
    }

    if (mouse_button == 2 || mouse_button == 3) {
        last_cam_x = settings.cameras.position.x;
        last_cam_y = settings.cameras.position.y;
    }
}

// Translate camera on right-mouse & rotate object on left-mouse
canvas.onmousemove = function(e) {
    if (mouse_down && draw_mode !== null) {
        let current_x = e.clientX;
        let current_y = e.clientY;

        let delta_x = current_x - mouse_x;
        let delta_y = current_y - mouse_y;

        if (mouse_button == 1) {
            new_trans_x = (delta_y / 100) + last_trans_x;
            new_trans_y = (delta_x / 100) + last_trans_y;

            // Rotate object on left-click
            settings.transformation.rotation.children[0].value = new_trans_x;
            settings.transformation.rotation.children[1].value = new_trans_y;
        }

        // Translate camera on right-click or wheel-click
        if (mouse_button == 2 || mouse_button == 3) {
            new_cam_x = (delta_x / 100) + last_cam_x;
            new_cam_y = (delta_y / -100) + last_cam_y;
            
            settings.cameras.position.x = new_cam_x;
            settings.cameras.position.y = new_cam_y;
        }

        draw(true);
    }
}

// Actions on mouse up
canvas.onmouseup = function(e) {
    mouse_down = false;

    if (mouse_button == 1) {
        var rotationX_input = document.getElementById('RotationX_input');
        var rotationY_input = document.getElementById('RotationY_input');
    
        rotationX_input.value = MATH.nice_radian_to_degree(new_trans_x);
        rotationY_input.value = MATH.nice_radian_to_degree(new_trans_y);
        
        update_trans_value(rotationX_input, true, MATH.nice_radian_to_degree(new_trans_x));
        update_trans_value(rotationY_input, true, MATH.nice_radian_to_degree(new_trans_y));
    }

    if (mouse_button == 2 || mouse_button == 3) {
        document.getElementById('cam_pos_x').value = new_cam_x;
        document.getElementById('cam_pos_y').value = new_cam_y;
    }
}

// Disable context menu when right-clicked
canvas.oncontextmenu = function(e) {
    return false;
}