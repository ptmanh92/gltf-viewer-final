/*============================ INITIALIZATION =============================*/
var MATH = new CustomMath(); // New math class
var MODE = {"learn": 0, "sample": 1, "zip": 2};
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
var IMG_MIME_TYPE = {
    "apng": ["apng"],
    "avif": ["avif"],
    "gif": ["gif"],
    "jpeg": ["jpg", "jpeg", "jfif", "pjpeg", "pjp"],
    "png": ["png"],
    "svg+xml": ["svg"],
    "webp": ["webp"]
};
var rgba_color = ["red", "green", "blue", "alpha"];
var GLTF = {};
var settings, basic_examples, model_data, current_cam, current_bufferView, current_accessor;
var current_scene = 0, learn_model = 0;
var program = null, current_animation = null, draw_mode = null;
var vertices = [];
var gltf_transform = MATH.matrix4.create(), trans_matrix = MATH.matrix4.create();
var requestOptions = {
    method: 'GET',
    redirect: 'follow'
}
// https://stackoverflow.com/questions/1759987/listening-for-variable-changes-in-javascript
var GLTF_FILE = {
    value: {},
    listener: function() {
        draw_sample();
    },
    listener_zip: function(model_data) {
        GLTF.draw_data(model_data);
    },
    get content() {
        return this.value
    },
    set content(value) {
        this.value = value
        this.listener();
    },
    set content_zip(value) {
        this.value = value;
    },
    set set_data(model_data) {
        this.listener_zip(model_data);
    }
}
// Important HTML elements
var spinner = document.getElementById('loading_spinner');
var spinner_text = document.getElementById('spinner_text');
var sample_models_content = document.getElementById('sample_models_content');
var animation_list = document.getElementById('animation_list');
var transformations_content = document.getElementById('transformations_content');
var camera_content = document.getElementById('camera_content');
var all_cams = document.getElementById('all_cams');
var camera_input = document.getElementById('camera_input');
var camera_position = document.getElementById('camera_position');
var color_channel = document.getElementById('color_channel');

/*================================ FUNCTIONS ==============================*/
// Create shaders
const createShader = (gl, source_code, type) => {
    // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source_code);
    gl.compileShader(shader);
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('ERROR compliling shader!', gl.getShaderInfoLog(shader))
        return;
    }

    return shader;
}

// Create program
const createProgram = (gl, vertexScript, fragmentScript) => {
    let program = gl.createProgram();

    var vertex_shader = createShader(gl, vertexScript, gl.VERTEX_SHADER);
    var fragment_shader = createShader(gl, fragmentScript, gl.FRAGMENT_SHADER);

    // Attach pre-existing shaders
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('ERROR linking program!', gl.getProgramInfoLog(program));
        return;
    }
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('ERROR validating program!', gl.getProgramInfoLog(program));
        return;
    }

    return program;
}

// Create HTML radio item
const create_radio = (name, label, state, data, onclick) => {
    let new_radio = '<div class="form-check"><label class="form-check-label">';
    new_radio += '<input type="radio" class="form-check-input" name="'+name+'" '+onclick+' '+data+' '+state+'>' + label;
    new_radio += '</label></div>';
    return new_radio;
}

// WebGL settings
const webgl_settings = (gl, options) => {
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
}

// Create HTML option of select list
const create_option = (value, title) => {
    let new_option = '<option value="'+value+'">'+title+'</option>';
    return new_option;
}

// Create input range
const create_input_range = (range_name, range_value_id, input_id, input_value, input_min, input_max, input_step, input_action, input_data) => {
    let new_range = '<div class="range_name">'+range_name+'</div>';
    new_range += '<div class="range_controller"><input type="range" class="form-control-range" id="'+input_id+'" min="'+input_min+'" max="'+input_max+'" step="'+input_step+'" value="'+input_value+'" oninput="'+input_action+'"'+input_data+'></div>';
    new_range += '<div class="range_value" id="'+range_value_id+'">'+input_value+'</div>';
    return new_range;
}

// Create input number
const create_input_number = (number_name, input_id, input_min, input_max, input_step, input_value, input_action, input_data) => {
    let new_input_number = '<div class="number_name">'+number_name+'</div>';
    new_input_number += '<div class="number_controller"><input type="number" class="form-control" id="'+input_id+'" min="'+input_min+'" max="'+input_max+'" step="'+input_step+'" value="'+input_value+'" oninput="'+input_action+'"'+input_data+'></div>';
    return new_input_number;
}

// Display the loading spinner
const show_spinner = (terminate, status, message) => {
    if (!terminate) {
        spinner.style.display = "none";
        spinner_text.innerText = "";
    } else {
        if (status) {
            spinner.style.display = "block";
            spinner_text.innerText = message;
        } else {
            spinner_text.innerText = "";
        }
    }
}


/*=============================== GLTF MODEL ==============================*/
var BYTE_SIZE = {
    5120: 1,    // BYTE
    5121: 1,    // UNSIGNED_BYTE
    5122: 2,    // SHORT
    5123: 2,    // UNSIGNED_SHORT
    5126: 4     // FLOAT
};

var COMPONENT_TYPE = {
    'SCALAR': 1,
    'VEC2': 2,
    'VEC3': 3,
    'VEC4': 4,
    'MAT2': 4,
    'MAT3': 9,
    'MAT4': 16
};

var accessor_to_array = (accessor) => {
    if (accessor.componentType == 5122) {
        new Int16Array(GLTF_FILE.value.bufferViews[accessor.bufferView].data, accessor.byteOffset, accessor.count * COMPONENT_TYPE[accessor.type]);
    } else if (accessor.componentType == 5123) {
        new Uint16Array(GLTF_FILE.value.bufferViews[accessor.bufferView].data, accessor.byteOffset, accessor.count * COMPONENT_TYPE[accessor.type]);
    } else if (accessor.componentType == 5124) {
        new Int32Array(GLTF_FILE.value.bufferViews[accessor.bufferView].data, accessor.byteOffset, accessor.count * COMPONENT_TYPE[accessor.type]);
    } else if (accessor.componentType == 5125) {
        new Uint32Array(GLTF_FILE.value.bufferViews[accessor.bufferView].data, accessor.byteOffset, accessor.count * COMPONENT_TYPE[accessor.type]);
    } else if (accessor.componentType == 5126) {
        new Float32Array(GLTF_FILE.value.bufferViews[accessor.bufferView].data, accessor.byteOffset, accessor.count * COMPONENT_TYPE[accessor.type]);
    } else {
        return null;
    }
}

GLTF.create_property = (attribute, property_name, extra_value) => {
    if (attribute[property_name] === undefined) {
        attribute[property_name] = extra_value !== undefined ? extra_value : null;
    }
}

// Prepare binary and images for glTF-file
GLTF.draw_data = async (model_data) => {
    show_spinner(true, true, "Loading glTF model")

    // Prepare data for glTF
    GLTF.prepare_buffers(model_data);
}

// Draw scene
GLTF.draw_scene = (cur_scene) => {
    // console.log("=> Loading scene "+ cur_scene +"...");
    var scene = GLTF_FILE.value.scenes[cur_scene];
    var root_node_indices = scene.nodes;

    // Do animation if exists
    if (GLTF_FILE.value.animations) {
        GLTF.do_animation(current_animation)
    }

    // Start drawing node
    for (let node_index of root_node_indices) {
        GLTF.draw_node(GLTF_FILE.value.nodes[node_index], scene.node_matrices, scene.unit_matrix);
    }
}

// Draw node
GLTF.draw_node = (node, scene_matrices, parent_matrix) => {
    var node_matrix = scene_matrices[node.id];
    node_matrix = parent_matrix === undefined ? MATH.matrix4.copy(node_matrix, node.matrix) : MATH.matrix4.multiply(parent_matrix, node.matrix);

    // Start drawing primitives (if mesh exists)
    if (node.mesh !== null) {
        for (let primitive of GLTF_FILE.value.meshes[node.mesh].primitives) {
            GLTF.draw_primitive(primitive, node_matrix);
        }
    }

    // Start drawing child-nodes (if exist)
    if (node.children.length > 0) {
        for (let child_node_index of node.children) {
            let child_node = GLTF_FILE.value.nodes[child_node_index];
            GLTF.draw_node(child_node, scene_matrices, node_matrix);
        }
    }
}

// Set texture uniform
GLTF.set_texture_uniform = (location, texture_info) => {
    gl.uniform1i(location, texture_info.index);
    // console.log(gl.TEXTURE0);
    gl.activeTexture(gl.TEXTURE0 + texture_info.index);
    var texture = GLTF_FILE.value.textures[texture_info.index];
    gl.bindTexture(gl.TEXTURE_2D, texture.data);

    var new_sampler = texture.sampler == null ? default_Sampler : GLTF_FILE.value.samplers[texture.sampler].data;
    // console.log(new_sampler);
    gl.bindSampler(texture_info.index, new_sampler);
}

// Draw primitive
GLTF.draw_primitive = (primitive, node_matrix) => {
    // console.log("=> Loading primitive...");

    // Update transformation matrix for each primitive
    gltf_transform = MATH.matrix4.multiply(trans_matrix, node_matrix);

    // Set base color (later has effect on final_color in fragment shader)
    var base_color = settings.static_color;

    // Check material options of each primitive
    if (primitive.material !== null) {
        let material = GLTF_FILE.value.materials[primitive.material];
        if (material !== null && material !== undefined) {
            base_color = material.pbrMetallicRoughness.baseColorFactor;

            // Enable back-face culling if doubleSided is false
            if (!material.doubleSided) {
                gl.enable(gl.CULL_FACE);
            } else {
                gl.disable(gl.CULL_FACE);
            }
        }
    }

    // Start using program
    program = program != primitive.program ? primitive.program : program;
    gl.useProgram(program);

    // Set material uniform (mostly textures) after program is being used
    if (primitive.uniforms !== undefined & primitive.uniforms !== null) {
        if (color_channel.value == 1) {
            // console.log("*** Set staticColor...")
            gl.uniform4fv(primitive.uniforms.staticColor, settings.static_color);
        } else {
            if (primitive.material !== null) {
                let material = GLTF_FILE.value.materials[primitive.material];

                if (material.pbrMetallicRoughness.baseColorFactor !== undefined & material.pbrMetallicRoughness.baseColorFactor !== null) {
                    // console.log("*** Set baseColorFactor...")
                    gl.uniform4fv(primitive.uniforms.baseColorFactor, material.pbrMetallicRoughness.baseColorFactor);
                }
                if (material.pbrMetallicRoughness.baseColorTexture !== undefined & material.pbrMetallicRoughness.baseColorTexture !== null) {
                    // console.log("*** Set baseColorTexture...")
                    GLTF.set_texture_uniform(primitive.uniforms.baseColorTexture, material.pbrMetallicRoughness.baseColorTexture);
                }
                if (material.occlusionTexture !== undefined & material.occlusionTexture !== null) {
                    // console.log("*** Set occlusionTexture...")
                    GLTF.set_texture_uniform(primitive.uniforms.occlusionTexture, material.occlusionTexture);
                    gl.uniform1f(primitive.uniforms.occlusionStrength, material.occlusionTexture.strength);
                }
                if (material.emissiveTexture !== undefined & material.emissiveTexture !== null) {
                    // console.log("*** Set emissiveTexture...")
                    GLTF.set_texture_uniform(primitive.uniforms.emissiveTexture, material.emissiveTexture);
                    gl.uniform3fv(primitive.uniforms.emissiveFactor, material.emissiveFactor);
                }
                
            }
        }
    }
    


    // Set final trans_matrix uniform
    gl.uniformMatrix4fv(primitive.uniforms.final_transformation, gl.FALSE, gltf_transform);

    // Bind current vertext array object
    gl.bindVertexArray(primitive.vao);

    // Actually draw things (vertices with/without indices)
    if (primitive.indices === null || primitive.indices === undefined) {
        // console.log("no indices");
        gl.drawArrays(primitive.mode, primitive.drawArrays_byteOffset, primitive.drawArrays_count);
    } else {
        // console.log("with indices");
        gl.drawElements(primitive.mode, primitive.drawElements_count, primitive.drawElements_componentType, primitive.drawElements_byteOffset);
    }

    // Un-bind current vertext array object
    gl.bindVertexArray(null);
}

// Do animation
GLTF.do_animation = (cur_animation) => {
    // console.log("=> Doing animation "+cur_animation+"...");
    var animation =  GLTF_FILE.value.animations[cur_animation];

    for (let ani_sampler of animation.samplers) {

    }

}

/* Prepare data for buffers
* Structure:
*  uri: .bin file-name / base64 data
*  byteLength: >= 1 (required)
*  name: String
*  extensions: Object
*  extras: Any
*  data: converted to ArrayBuffer (custom)
*/ 
GLTF.prepare_buffers = async (model_data) => {   
    if (GLTF_FILE.value.hasOwnProperty('buffers')) {
        console.log("=> Preparing buffers...");

        for (let buffer of GLTF_FILE.value.buffers) {
            GLTF.create_property(buffer, 'uri');

            if (buffer.uri !== null) {
                if (model_data.bin.length > 0) {
                    for (let bin of model_data.bin) {
                        if (buffer.uri == get_file_name_from_uri(bin.name)) {   // Get bin file as ArrayBuffer
                            await bin.async("arraybuffer")
                            .then(function (content) {
                                buffer.data = content;
                            }, function(e) {
                                console.log("=> ERROR: converting buffer to ArrayBuffer failed!!! " + e.message);
                            });
                        }
                    }
                } else {
                    // Decode base64
                    if (buffer.uri.startsWith('data:application/octet-stream;base64,')) {
                        console.log(true)
                        let base64_str = buffer.uri.slice(37, buffer.uri.length);
                        let bin_str = window.atob(base64_str);
                        let bytes = new Uint8Array(bin_str.length);
                        for (let i = 0; i < bin_str.length; i++) {
                            bytes[i] = bin_str.charCodeAt(i);
                        }
                        buffer.data = bytes.buffer;
                    }
                }
            }
            
            GLTF.create_property(buffer, 'name');
            GLTF.create_property(buffer, 'extensions');
            GLTF.create_property(buffer, 'extras');
        }
    }

    GLTF.prepare_bufferviews();
}

/* Prepare data for bufferViews
* Structure:
*  buffer: index of buffer (required)
*  byteOffset: default 0
*  byteLength: >= 1 (required)
*  byteStride: default 0 (>= 4 && <= 252 && used for gl.vertexAttribPointer())
*  target: default null (34962: ARRAY_BUFFER || 34963: ELEMENT_ARRAY_BUFFER)
*  name: String
*  extensions: Object
*  extras: Any
*  new_buffer: (custom)
*/ 
GLTF.prepare_bufferviews = () => {

    if (GLTF_FILE.value.bufferViews) {
        console.log("=> Preparing bufferViews...");

        var buffer_data;

        // Get buffer data if there's only 1 buffer/bin-file
        if (GLTF_FILE.value.buffers.length == 1) {
            buffer_data = GLTF_FILE.value.buffers[0].data;
        }
    
        for (let buffer_view of GLTF_FILE.value.bufferViews) {
            // Prepare buffer data if have not
            if (buffer_data === undefined || buffer_data === null) {
                buffer_data = GLTF_FILE.value.buffers[buffer_view.buffer].data;
            }

            GLTF.create_property(buffer_view, 'byteOffset', 0);
            GLTF.create_property(buffer_view, 'byteStride', 0);
            GLTF.create_property(buffer_view, 'target');
            GLTF.create_property(buffer_view, 'extensions');
            GLTF.create_property(buffer_view, 'extras');

            let b_offset = buffer_view.byteOffset;
            let b_length = buffer_view.byteLength;
            buffer_view.data = buffer_data.slice(b_offset, b_offset + b_length);

            GLTF.create_property(buffer_view, 'new_buffer');
        }
    }

    // Continue to prepare data for images
    GLTF.prepare_images(model_data);
}

/* Prepare data for accessors
* Structure:
*  bufferView: index of bufferView
*  byteOffset: default 0
*  componentType: related to BYTE_SIZE (required)
*  normalized: default false
*  count: >= 1 (required)
*  type: related to COMPONENT_TYPE (required)
*  max: length relates to COMPONENT_TYPE
*  min: length relates to COMPONENT_TYPE
*  sparse: Object
*  name: String
*  extensions: Object
*  extras: Any
*  size: depends on COMPONENT_TYPE (custom)
*/ 
GLTF.prepare_accessors = () => {
    if (GLTF_FILE.value.accessors) {
        console.log("=> Preparing accessors...");

        for (let accessor of GLTF_FILE.value.accessors) {
            GLTF.create_property(accessor, 'bufferView');
            GLTF.create_property(accessor, 'byteOffset', 0);
            GLTF.create_property(accessor, 'byteStride', GLTF_FILE.value.bufferViews[accessor.bufferView]);
            GLTF.create_property(accessor, 'normalized', false);
            GLTF.create_property(accessor, 'max');
            GLTF.create_property(accessor, 'min');
            GLTF.create_property(accessor, 'sparse');
            GLTF.create_property(accessor, 'name');
            GLTF.create_property(accessor, 'extensions');
            GLTF.create_property(accessor, 'extras');

            accessor.size = COMPONENT_TYPE[accessor.type]
        }
    }
}

// Prepare data for pbrMetallicRoughness
GLTF.prepare_pbrMetallicRoughness = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        GLTF.create_property(attribute[property_name], 'baseColorFactor', [1.0, 1.0, 1.0, 1.0]);
        GLTF.create_property(attribute[property_name], 'baseColorTexture');
        if (attribute[property_name].baseColorTexture !== undefined && attribute[property_name].baseColorTexture !== null) {
            GLTF.create_property(attribute[property_name].baseColorTexture, 'texCoord', 0);
            GLTF.create_property(attribute[property_name].baseColorTexture, 'extensions');
            GLTF.create_property(attribute[property_name].baseColorTexture, 'extras');
        }
        GLTF.create_property(attribute[property_name], 'metallicFactor', 1.0);
        GLTF.create_property(attribute[property_name], 'roughnessFactor', 1.0);
        GLTF.create_property(attribute[property_name], 'metallicRoughnessTexture');
        if (attribute[property_name].metallicRoughnessTexture !== undefined && attribute[property_name].metallicRoughnessTexture !== null) {
            GLTF.create_property(attribute[property_name].metallicRoughnessTexture, 'texCoord', 0);
            GLTF.create_property(attribute[property_name].metallicRoughnessTexture, 'extensions');
            GLTF.create_property(attribute[property_name].metallicRoughnessTexture, 'extras');
        }
        GLTF.create_property(attribute[property_name], 'extensions');
        GLTF.create_property(attribute[property_name], 'extras');
    } else {
        attribute[property_name] = {
            baseColorFactor: [1, 1, 1, 1],
            metallicFactor: 1,
            metallicRoughnessTexture: 1
        }
    }
}
// Prepare data for normalTexture
GLTF.prepare_normalTexture = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        GLTF.create_property(attribute[property_name], 'texCoord', 0);
        GLTF.create_property(attribute[property_name], 'scale', 1);
        GLTF.create_property(attribute[property_name], 'extensions');
        GLTF.create_property(attribute[property_name], 'extras');
    } else {
        attribute[property_name] = null
    }
}
// Prepare data for occlusionTexture
GLTF.prepare_occlusionTexture = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        GLTF.create_property(attribute[property_name], 'texCoord', 0);
        GLTF.create_property(attribute[property_name], 'strength', 1);
        GLTF.create_property(attribute[property_name], 'extensions');
        GLTF.create_property(attribute[property_name], 'extras');
    } else {
        attribute[property_name] = null
    }
}
// Prepare data for emissiveTexture
GLTF.prepare_emissiveTexture = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        GLTF.create_property(attribute[property_name], 'texCoord', 0);
        GLTF.create_property(attribute[property_name], 'extensions');
        GLTF.create_property(attribute[property_name], 'extras');
    } else {
        attribute[property_name] = null
    }
}

/* Prepare data for materials
* Structure:
*  name: String
*  extensions: Object
*  extras: Any
*  pbrMetallicRoughness: Object
*    baseColorFactor: default [1, 1, 1, 1]
*    baseColorTexture: Texture for baseColorFactor
*    metallicFactor: default 1
*    roughnessFactor: default 1
*    metallicRoughnessTexture: Texture for metallicFactor & roughnessFactor
*    extensions: Object
*    extras: Any
*  normalTexture: Object
*    index: (required)
*    texCoord: default 0
*    scale: default 1
*    extensions: Object
*    extras: Any
*  occlusionTexture: Object
*    index: (required)
*    texCoord: default 0
*    strength: default 1
*    extensions: Object
*    extras: Any
*  emissiveTexture: Object
*    index: (required)
*    texCoord: default 0
*    extensions: Object
*    extras: Any
*  emissiveFactor: default [0, 0, 0]
*  alphaMode: default "OPAQUE"
*  alphaCutoff: default 0.5
*  doubleSided: default false
*/ 
GLTF.prepare_materials = () => {
    console.log("=> Preparing materials...");

    if (GLTF_FILE.value.materials) {
        for (let material of GLTF_FILE.value.materials) {
            GLTF.create_property(material, 'name');
            GLTF.create_property(material, 'extensions');
            GLTF.create_property(material, 'extras');

            GLTF.prepare_pbrMetallicRoughness(material, 'pbrMetallicRoughness');
            GLTF.prepare_normalTexture(material, 'normalTexture');
            GLTF.prepare_occlusionTexture(material, 'occlusionTexture');
            GLTF.prepare_emissiveTexture(material, 'emissiveTexture');

            GLTF.create_property(material, 'emissiveFactor', [0, 0, 0]);
            GLTF.create_property(material, 'alphaMode', "OPAQUE");
            GLTF.create_property(material, 'alphaCutoff', 0.5);
            GLTF.create_property(material, 'doubleSided', false);
        }
    }
}

/* Prepare data for images
* Structure:
*  uri: link to image file (use this only when bufferView not exists)
*  mimeType: (required if bufferView exists)
*  bufferView: index of bufferView (which contains the image)
*  name: String
*  extensions: Object
*  extras: Any
*  data: converted HTML <img> (custom)
*/
GLTF.prepare_images = async (model_data) => {
    // Get image/texture file as base64
    if (GLTF_FILE.value.hasOwnProperty('images')) {
        console.log("=> Preparing images...");

        for (let image of GLTF_FILE.value.images) {
            GLTF.create_property(image, 'uri');
            GLTF.create_property(image, 'bufferView');
            GLTF.create_property(image, 'mimeType');
            GLTF.create_property(image, 'name');
            GLTF.create_property(image, 'extensions');
            GLTF.create_property(image, 'extras');

            if (model_data.images.length > 0) {
                for (let model_img of model_data.images) {
                    if (image.uri == model_img.name) {
                        // await model_img.async("arraybuffer")
                        // .then(function(content) {
                        //     // console.log(content);
                        //     var buffer = new Uint8Array(content);
                        //     var blob = new Blob([buffer.buffer]);
                        //     console.log(blob);
                        //     var img = new Image;
                        //     img.crossOrigin = "Anonymous";
                        //     img.src = URL.createObjectURL(blob);
                        //     img.onload = function() {
                        //         document.getElementById('zip_details_content').appendChild(this);
                        //         image.data = this
                        //     }
                        // }, function(e) {
                        //     console.log("=> ERROR: converting image to arraybuffer failed!!! " + e.message);
                        // });

                        let img_extension = get_file_extension(model_img.name);

                        await model_img.async("base64")
                        .then(function (content) {
                            let mime_type = get_img_mime_type(img_extension);
                            if (mime_type !== null && mime_type !== undefined) {
                                var new_img = new Image();
                                new_img.src = "data:" + mime_type + ";base64," + content;
                                
                                image.data = new_img
                            }
                        }, function(e) {
                            console.log("=> ERROR: converting image to base64 failed!!! " + e.message);
                        });
                    }
                }
            } else {
                if (image.bufferView !== undefined && image.bufferView !== null && image.mimeType !== undefined && image.mimeType !== null) {
                    let bin = "";
                    let bytes = new Uint8Array(GLTF_FILE.value.bufferViews[image.bufferView].data);
                    for (let i = 0; i < bytes.byteLength; i++) {
                        bin += String.fromCharCode(bytes[i]);
                    }
                    let base_str = window.btoa(bin);

                    let new_img = new Image();
                    new_img.src = "data:" + image.mimeType + ";base64," + base_str;
                    image.data = new_img
                }
            }
        }
    }

    // Continue to prepare data for glTF
    GLTF.prepare_scenes();
    GLTF.prepare_nodes();
    GLTF.prepare_accessors();
    GLTF.prepare_materials();
    GLTF.prepare_samplers();
    GLTF.prepare_textures();
    GLTF.prepare_meshes();
    GLTF.prepare_animations();
    GLTF.prepare_skins();

    // Update GUI
    gui_get_animations(GLTF_FILE.content);
    gui_transformations();
    reset_trans_value(true);
    gui_cameras(GLTF_FILE.content);
    gui_scenes(GLTF_FILE.content);
    gui_textures(GLTF_FILE.content);
    gui_gltf();
    gui_options_color(settings.static_color, "static");
    gui_options_color(settings.background_color, "bkgr");
    show_spinner(false);

    console.log(GLTF_FILE.value);

    // Start drawing
    draw(false);
}

/* Prepare data for samplers
* Structure:
*  magFilter: 9726 NEAREST || 9729 LINEAR
*  minFilter: 9728 NEAREST || 9729 LINEAR || 9984 NEAREST_MIPMAP_NEAREST || 9985 LINEAR_MIPMAP_NEAREST || 9986 NEAREST_MIPMAP_LINEAR || 9987 LINEAR_MIPMAP_LINEAR
*  wrapS: 33071 CLAMP_TO_EDGE || 33648 MIRRORED_REPEAT || 10497 REPEAT (default 10497)
*  wrapT: 33071 CLAMP_TO_EDGE || 33648 MIRRORED_REPEAT || 10497 REPEAT (default 10497)
*  name: String
*  extensions: Object
*  extras: Any
*  data: (custom)
*/
GLTF.prepare_samplers = () => {
    if (GLTF_FILE.value.hasOwnProperty('samplers')) {
        console.log("=> Preparing samplers...");

        for (let sampler of GLTF_FILE.value.samplers) {
            GLTF.create_property(sampler, 'magFilter');
            GLTF.create_property(sampler, 'minFilter');
            GLTF.create_property(sampler, 'wrapS', 10497);
            GLTF.create_property(sampler, 'wrapT', 10497);
            GLTF.create_property(sampler, 'name');
            GLTF.create_property(sampler, 'extensions');
            GLTF.create_property(sampler, 'extras');
            GLTF.create_property(sampler, 'data');
        }
    }
}

/* Prepare data for textures
* Structure:
*  sampler: index of sampler
*  source: index of image
*  name: String
*  extensions: Object
*  extras: Any
*  data: (custom)
*/
GLTF.prepare_textures = () => {
    if (GLTF_FILE.value.hasOwnProperty('textures')) {
        console.log("=> Preparing textures...");

        for (let texture of GLTF_FILE.value.textures) {
            GLTF.create_property(texture, 'sampler');
            GLTF.create_property(texture, 'source');
            GLTF.create_property(texture, 'name');
            GLTF.create_property(texture, 'extensions');
            GLTF.create_property(texture, 'extras');
            GLTF.create_property(texture, 'data');
        }
    }
}

// Prepare data for primitives
GLTF.prepare_primitives = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        for (let primitive of attribute[property_name]){
            GLTF.create_property(primitive, 'indices');
            GLTF.create_property(primitive, 'material');
            GLTF.create_property(primitive, 'mode', 4);
            GLTF.create_property(primitive, 'name');
            GLTF.create_property(primitive, 'extensions');
            GLTF.create_property(primitive, 'extras');
            GLTF.create_property(primitive, 'targets', []);
    
            if (primitive.indices !== null && primitive.indices !== undefined) {
                // for gl.drawElements() = draw vertices with their indices
                primitive.drawElements_componentType = GLTF_FILE.value.accessors[primitive.indices].componentType;
                primitive.drawElements_count = GLTF_FILE.value.accessors[primitive.indices].count;
                primitive.drawElements_byteOffset = GLTF_FILE.value.accessors[primitive.indices].byteOffset;
            } else {
                // for gl.drawArrays() = draw vertices without their indices (required POSITION);
                if (primitive.attributes.POSITION !== null && primitive.attributes.POSITION !== undefined) {
                    primitive.drawArrays_count = GLTF_FILE.value.accessors[primitive.attributes.POSITION].count;
                    primitive.drawArrays_byteOffset = GLTF_FILE.value.accessors[primitive.attributes.POSITION].count;
                }
            }
        }
    } else {
        attribute[property_name] = []
    }
}

/* Prepare data for meshes
* Structure:
*  primitives: Array (required)
*  weights: Array (for Morph Targets)
*  name: String
*  extensions: Object
*  extras: Any
*/
GLTF.prepare_meshes = () => {
    if (GLTF_FILE.value.hasOwnProperty('meshes')) {
        console.log("=> Preparing meshes...");

        for (let mesh of GLTF_FILE.value.meshes) {
            GLTF.prepare_primitives(mesh, 'primitives');
            GLTF.create_property(mesh, 'weights');
            GLTF.create_property(mesh, 'name');
            GLTF.create_property(mesh, 'extensions');
            GLTF.create_property(mesh, 'extras');
        }
    }
}

// Prepare data for node matrix
const get_node_translation = (node, extra_value) => {
    if (node.translation === undefined) {
        return extra_value === undefined ? [0, 0, 0] : extra_value;
    } else {
        return node.translation;
    }
}
const get_node_rotation = (node, extra_value) => {
    if (node.rotation === undefined) {
        return extra_value === undefined ? [0, 0, 0, 1] : extra_value;
    } else {
        return node.rotation;
    }
}
const get_node_scale = (node, extra_value) => {
    if (node.scale === undefined) {
        return extra_value === undefined ? [1, 1, 1]: extra_value;
    } else {
        return node.scale;
    }
}
GLTF.prepare_node_transformation = (attribute) => {
    var matrix = MATH.matrix4.create();
    if (attribute.matrix === undefined) {
        // If matrix not exists, then create one from translation, rotation & scale
        attribute.translation = get_node_translation(attribute);
        attribute.rotation = get_node_rotation(attribute);
        attribute.scale = get_node_scale(attribute);

        matrix = glMatrix.mat4.fromRotationTranslation(matrix, attribute.rotation, attribute.translation);
        attribute.matrix = glMatrix.mat4.scale(matrix, matrix, attribute.scale);
    } else {
        // If matrix already existed, then create translation, rotation & scale
        attribute.translation = get_node_translation(attribute, MATH.matrix4.get_translation(attribute.matrix));
        attribute.rotation = get_node_rotation(attribute, glMatrix.mat4.getRotation(matrix, attribute.matrix));
        attribute.scale = get_node_scale(attribute, MATH.matrix4.get_scale(attribute.matrix));
    }
}

/* Prepare data for nodes
* Structure:
*  camera: index of camera
*  children: Array of indices of child-nodes (default [])
*  skin: index of skin
*  matrix: 4x4 matrix transformation (default [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
*  mesh: index of mesh
*  rotation: default [0,0,0,1]
*  scale: default [1,1,1]
*  translation: default [0,0,0]
*  name: String
*  extensions: Object
*  extras: Any
*  id: node index (custom)
*/
GLTF.prepare_nodes = () => {
    if (GLTF_FILE.value.hasOwnProperty('nodes')) {
        console.log("=> Preparing nodes...");

        var node_index = 0;
        for (let node of GLTF_FILE.value.nodes) {
            GLTF.create_property(node, 'camera');
            GLTF.create_property(node, 'children', []);
            GLTF.create_property(node, 'skin');
            GLTF.prepare_node_transformation(node); // Matrix, rotation, scale & translation

            GLTF.create_property(node, 'mesh');
            GLTF.create_property(node, 'weights');
            GLTF.create_property(node, 'name');
            GLTF.create_property(node, 'extensions');
            GLTF.create_property(node, 'extras');

            GLTF.create_property(node, 'id', node_index);

            node_index++;
        }
    }
}

/* Prepare data for scenes
* Structure:
*  name: String
*  nodes: indices of root-nodes
*  extensions: Object
*  extras: Any
*  node_matrices: Array with length is number of nodes (custom)
*  unit_matrix (custom)
*/
GLTF.prepare_scenes = () => {
    if (GLTF_FILE.value.hasOwnProperty('scenes')) {
        console.log("=> Preparing scenes...");

        for (let scene of GLTF_FILE.value.scenes) {
            GLTF.create_property(scene, 'name');
            GLTF.create_property(scene, 'nodes', []);
            GLTF.create_property(scene, 'extensions');
            GLTF.create_property(scene, 'extras');

            var new_node_matrices = new Array(GLTF_FILE.value.nodes.length);
            for (let i = 0; i < GLTF_FILE.value.nodes.length; i++) {
                new_node_matrices[i] = MATH.matrix4.create();
            }
            GLTF.create_property(scene, 'node_matrices', new_node_matrices);
            GLTF.create_property(scene, 'unit_matrix', MATH.matrix4.create());
        }
    }
}

// Prepare data for animation channels
GLTF.prepare_animation_channels = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        for (let channel of attribute[property_name]) {
            if (channel.target !== undefined) {
                GLTF.create_property(channel.target, 'node');
                GLTF.create_property(channel.target, 'extensions');
                GLTF.create_property(channel.target, 'extras');
            }
            GLTF.create_property(channel, 'extensions');
            GLTF.create_property(channel, 'extras');
        }
    } else {
        attribute[property_name] = null
    }
}

// Prepare data for animation samplers
GLTF.prepare_animation_samplers = (attribute, property_name) => {
    if (attribute[property_name] !== undefined) {
        for (let sampler of attribute[property_name]) {
            GLTF.create_property(sampler, 'interpolation', 'LINEAR');
            GLTF.create_property(sampler, 'extensions');
            GLTF.create_property(sampler, 'extras');


        }
    } else {
        attribute[property_name] = null
    }
}

/* Prepare data for animations
* Structure:
*  channels: (required)
*  samplers: (required)
*  name: String
*  extensions: Object
*  extras: Any
*/
GLTF.prepare_animations = () => {
    if (GLTF_FILE.value.hasOwnProperty('animations')) {
        console.log("=> Preparing animations...");

        for (let animation of GLTF_FILE.value.animations) {
            GLTF.prepare_animation_channels(animation, 'channels');
            GLTF.prepare_animation_samplers(animation, 'samplers');

            GLTF.create_property(animation, 'name');
            GLTF.create_property(animation, 'extensions');
            GLTF.create_property(animation, 'extras');
        }
    }
}

/* Prepare data for skins
* Structure:
*  inverseBindMatrices: The index of the accessor containing the floating-point 4x4 inverse-bind matrices
*  skeleton: The index of the node used as a skeleton root.
*  joints: (required)
*  name: String
*  extensions: Object
*  extras: Any
*/
GLTF.prepare_skins = () => {
    if (GLTF_FILE.value.hasOwnProperty('skins')) {
        console.log("=> Preparing skins...");

        for (let skin of GLTF_FILE.value.skins) {
            GLTF.create_property(skin, 'inverseBindMatrices');
            GLTF.create_property(skin, 'skeleton');

            GLTF.create_property(skin, 'name');
            GLTF.create_property(skin, 'extensions');
            GLTF.create_property(skin, 'extras');
        }
    }
}


/*================================== GUI ==================================*/
/*========================= General ==========================*/
const gui_settings = async () => {
    await fetch("assets/js/settings.json", requestOptions)
    .then(response => response.json())
    .then(result => {
        settings = result;
        gui_list_basic_examples();
        gui_transformations();
        gui_cameras();
        gui_gltf();
        gui_options_color(settings.static_color, "static");
        gui_options_color(settings.background_color, "bkgr");
    })
    .catch(error => console.log('error', error));
}

const gui_gltf = () => {
    document.getElementById('color_channel').disabled = draw_mode == MODE.zip ? false : true;
    document.getElementById('scene_list').disabled = draw_mode == MODE.zip ? false : true;
}

/*=================== Basic WebGL examples ===================*/
// List all basic WebGL examples
const gui_list_basic_examples = async () => {
    show_spinner(true, true, "Loading basic examples...");
    let basic_examples_content = document.getElementById('basic_examples_content');

    await fetch("learn/model-index.json")
    .then(response => response.json())
    .then(examples => {
        basic_examples = examples;
        let i = 0;
        for (let example of basic_examples) {
            basic_examples_content.innerHTML += create_radio("basic_example", example.name, '', 'data-name="'+example.name+'" data-mode="'+example.mode+'" data-id="'+i+'"', 'onclick=draw_basic(this)');
            i++;
        }
    });

    // console.log("Done loading basic examples")
    show_spinner(false);
}
// Draw basic WebGL example
const draw_basic = (self) => {
    let id = self.getAttribute("data-id");

    draw_mode = MODE.learn;
    learn_model = id;

    gui_options_color(settings.background_color, "bkgr");
    trans_state();
    cams_state();
    
    draw(false);
}

/*======================= Sample models ======================*/
// Fetch gltf model
const get_model = async (self) => {
    console.log("Getting model...");
    show_spinner(true, true, "Fetching model data...");

    let model_name = self.getAttribute('data-name');
    let base_url = "models/" + model_name + "/";
    var file_url = base_url + model_name + ".gltf";

    // Get content of gltf file
    if (file_url != "") {
        await fetch(file_url, requestOptions)
        .then(response => response.json())
        .then(result => {
            GLTF_FILE.content = result;
        })
        .catch(error => console.log('error', error));
    }
    show_spinner(false);
}
// List all sample models
const gui_list_sample_models = async () => {
    show_spinner(true, true, "Fetching sample models...");

    await fetch("models/model-index.json")
    .then(response => response.json())
    .then(sample_models => {
        for (let model of sample_models) {
            sample_models_content.innerHTML += create_radio("sample_model", model.name, '', 'data-name="'+model.name+'"', 'onclick=get_model(this)');
        }
    });

    show_spinner(false);
}
// Draw sample model 
const draw_sample = () => {
    gui_get_animations(GLTF_FILE.content);
    gui_cameras(GLTF_FILE.content);

    // draw(false);
}

/*======================== Animations ========================*/
// List available animations
const gui_get_animations = async (gltf_file) => {
    console.log("=> Loading animations...");

    animation_list.innerHTML = "";

    if (gltf_file.hasOwnProperty('animations')) {
        if (gltf_file.animations.length > 0) {
            for (i = 0; i < gltf_file.animations.length; i++) {
                let animation_name = gltf_file.animations[i].name || "Animation " + (i + 1);
                animation_list.innerHTML += create_radio("current_animation", animation_name);
            }
        }
        current_animation = 0;
    } else {
        animation_list.innerHTML = "No animations available"
        current_animation = null;
    }
}

/*====================== Transformations =====================*/
const gui_transformations = () => {
    transformations_content.innerHTML = "";

    for (let type in settings.transformation) {
        let trans_type = settings.transformation[type];
        let transformations_title = document.createElement('div');
        transformations_title.setAttribute('class', 'transformations_title');
        transformations_title.innerText = trans_type.name;

        let transformations_input = document.createElement('div');
        transformations_input.setAttribute('class', 'transformations_input');

        let transformations_input_scale = document.createElement('div');
        transformations_input_scale.setAttribute('class', 'transformations_input_scale');

        if (trans_type.children.length > 0) {
            for (let child of trans_type.children) {
                if (trans_type.name == "Scale") {
                    transformations_input_scale.innerHTML += create_input_number(child.name, trans_type.name+child.name+"_input", 0, "", 0.1, trans_type.default, "update_trans_value(this, false)", ' data-parent="'+trans_type.name+'" data-child="'+child.name+'"')
                } else {
                    let new_max, new_min;
                    if (trans_type.max == null) {
                        new_max = child.name == "X" ? gl.canvas.width / 2 : gl.canvas.height / 2;
                    } else {
                        new_max = trans_type.max;
                    }

                    if (trans_type.min == null) {
                        new_min = child.name == "X" ? gl.canvas.width / (-2) : gl.canvas.height / (-2);
                    } else {
                        new_min = trans_type.min;
                    }

                    transformations_input.innerHTML += create_input_range(child.name, trans_type.name+child.name+"_value", trans_type.name+child.name+"_input", trans_type.default, new_min, new_max, trans_type.step, "update_trans_value(this, false)", ' data-parent="'+trans_type.name+'" data-child="'+child.name+'"')
                }
            }
        }

        transformations_content.appendChild(transformations_title);
        if (trans_type.name == "Scale") {
            transformations_content.appendChild(transformations_input_scale);
        } else {
            transformations_content.appendChild(transformations_input);
        }
    }

    trans_state();
}
const update_trans_value = (self, gui_only, extra_value) => {
    let data_parent = self.getAttribute('data-parent');
    let data_child = self.getAttribute('data-child');
    let value_field_name = data_parent + data_child + "_value";
    let value_field = document.getElementById(value_field_name);

    if (data_parent !== "Scale") {
        value_field.innerText = extra_value|| self.value;
    }

    for (let type in settings.transformation) {
        let tran = settings.transformation[type];
        if (tran.name == data_parent) {
            for (let child of tran.children) {
                if (child.name == data_child) {
                    child.value = extra_value || self.value;
                    set_trans(data_parent.toLowerCase(), data_child.toLowerCase(), extra_value || self.value);
                    break;
                }
            }
            break;
        }
    }

    if (gui_only == false) {
        draw(true);
    } 
}
const get_trans = (type, coord) => {
    let output;
    for (let trans_type in settings.transformation) {
        let tran = settings.transformation[trans_type]
        if (tran.name.toLowerCase() == type) {
            for (let child of tran.children) {
                if (child.name.toLowerCase() == coord) {
                    output = child.value;
                    break;
                }
            }
            break;
        }
    }
    return output;
}
const set_trans = (type, coord, value) => {
    for (let tran_type in settings.transformation) {
        let tran = settings.transformation[tran_type]
        if (tran.name.toLowerCase() == type) {
            for (let child of tran.children) {
                if (child.name.toLowerCase() == coord) {
                    if (type == "translation") {
                        child.value = coord == "x" ? 2 * value / gl.canvas.width : 2 * value / gl.canvas.height;
                    }
                    if (type == "rotation") {
                        child.value = MATH.degree_to_radian(value);
                    }
                    if (type == "scale") {
                        child.value = value;
                    }
                    break;
                }
            }
            break;
        }
    }
}
const reset_trans_value = (gui_only) => {
    for (let type in settings.transformation) {
        let tran = settings.transformation[type]
        for (let child of settings.transformation[type].children) {
            child.value = tran.default;

            if (tran.name !== "Scale") {
                let html_value = document.getElementById(tran.name + child.name + "_value");
                html_value.innerText = tran.default;
            }

            let html_input = document.getElementById(tran.name + child.name + "_input");
            html_input.value = tran.default;
        }
    }
    if (!gui_only) {
        draw(true);
    }
}
const trans_state = () => {
    console.log("Check trans state")
    for (let type in settings.transformation) {
        let tran = settings.transformation[type];
        let children = tran.children
            
        for (let child of children) {
            let html_input = document.getElementById(tran.name + child.name + "_input");
            html_input.disabled = draw_mode == null ? true : false;
        }
    }

    let trans_reset_btn = document.getElementById('trans_reset_btn');
    trans_reset_btn.disabled = draw_mode == null ? true : false;
}

/*========================= Cameras ==========================*/
// List all cameras
const gui_cameras = (gltf_file) => {
    console.log("=> Loading cameras...");
    // Set optimal aspect ratio for perspective camera
    settings.cameras.standard[0].aspectRatio = optimal_aspect_ratio();

    // Use cameras from gltf file or standard cameras
    var cameras = settings.cameras.standard;
    if (gltf_file !== undefined && gltf_file !== null) {
        let gltf_cameras = gltf_file.cameras || [];

        if (gltf_cameras.length > 0) {
            let new_cameras = [];
            for (let gltf_camera of gltf_cameras) {
                let new_camera = {};
                if (gltf_camera.hasOwnProperty('perspective')) {
                    new_camera.type = "perspective";
                    new_camera.default = gltf_camera.perspective;
                    for (let attr in gltf_camera.perspective) {
                        new_camera[attr] = gltf_camera.perspective[attr];
                    }
                } else if (gltf_camera.hasOwnProperty('orthographic')) {
                    new_camera.type = "orthographic";
                    new_camera.default = gltf_camera.orthographic;
                    for (let attr in gltf_camera.orthographic) {
                        new_camera[attr] = gltf_camera.orthographic[attr];
                    }
                }
                new_cameras.push(new_camera);
            }
            settings.cameras.gltf = new_cameras;
            cameras = new_cameras;
            // console.log(new_cameras);
        }
    }

    // Create GUI for cameras
    if (cameras !== undefined && cameras !== null) {
        all_cams.innerHTML = "";
        camera_input.innerHTML = "";

        // List all camera titles
        var index = 0;
        for (let cam_type in cameras) {
            let camera = cameras[cam_type];

            // Set camera name
            var name;
            if (camera.hasOwnProperty('name')) {
                name = camera.name;
            } else if (camera.hasOwnProperty('type')) {
                name = "Camera " + index + ": " + camera.type
            } else {
                name = "Camera " + index
            }

            all_cams.innerHTML += create_option(index, name);
            if (index == 0) {
                all_cams.value = index
            }
            index++;
        }

        // List camera inputs
        current_cam = cameras[all_cams.value];
        camera_detail(all_cams.value)
    } else {
        camera_content.innerHTML = "Failed to load cameras..."
    }

    // Camera position
    camera_position.innerHTML = "";
    camera_position.innerHTML += "<div>Camera position</div>";
    camera_position.innerHTML += create_input_number("X", "cam_pos_x", "", "", 0.1, settings.cameras.position.x, "update_camera_pos(this)", 'data-coord="x"');
    camera_position.innerHTML += create_input_number("Y", "cam_pos_y", "", "", 0.1, settings.cameras.position.y, "update_camera_pos(this)", 'data-coord="y"');
    camera_position.innerHTML += create_input_number("Z", "cam_pos_z", "", "", 0.1, settings.cameras.position.z, "update_camera_pos(this)", 'data-coord="z"');

    cams_state()
}
// Camera details
const camera_detail = (cam_id) => {
    if (current_cam.type == "perspective") {
        let fov = MATH.nice_radian_to_degree(current_cam.yfov);
        // let fov = Math.round(MATH.radian_to_degree(current_cam.yfov))
        // if (fov < -360) fov = -360
        // if (fov > 360) fov = 360
        camera_input.innerHTML += create_input_range("FOV", "yfov_value", "yfov", fov, -360, 360, 1, "update_camera(this)", 'data-cam-id="'+cam_id+'" data-field-name="yfov"')
        camera_input.innerHTML += create_input_number("Aspect ratio", "aspectRatio", "", "", 0.1, current_cam.aspectRatio || optimal_aspect_ratio(), "update_camera(this)", 'data-cam-id="'+cam_id+'" data-field-name="aspectRatio"');
    }

    if (current_cam.type == "orthographic") {
        camera_input.innerHTML += create_input_number("Horizontal", "xmag", "", "", 0.1, current_cam.xmag, "update_camera(this)", 'data-cam-id="'+cam_id+'" data-field-name="xmag"');
        camera_input.innerHTML += create_input_number("Vertical ", "ymag", "", "", 0.1, current_cam.ymag, "update_camera(this)", 'data-cam-id="'+cam_id+'" data-field-name="ymag"');
    }

    camera_input.innerHTML += create_input_number("Near", "znear", "", "", 0.01, current_cam.znear, "update_camera(this)", 'data-cam-id="'+cam_id+'" data-field-name="znear"');
    camera_input.innerHTML += create_input_number("Far", "zfar", "", "", 1.0, current_cam.zfar, "update_camera(this)", 'data-cam-id="'+cam_id+'" data-field-name="zfar"');
}
// Select camera
const select_camera = (self) => {
    camera_input.innerHTML = ""
    let cam_id = self.value;
    // console.log(cam_id)

    if (settings.cameras.gltf.length > 0) {
        current_cam = settings.cameras.gltf[cam_id];
    } else {
        current_cam = settings.cameras.standard[cam_id];
    }
    
    camera_detail(cam_id)
    draw(true);
}
// Update camera
const update_camera = (self) => {
    let cam_id = self.getAttribute('data-cam-id');
    let field_value_name = self.getAttribute('data-field-name')
    let field_value = document.getElementById(field_value_name+"_value");
    
    if (settings.cameras.gltf.length > 0) {
        settings.cameras.gltf[cam_id][field_value_name] = MATH.degree_to_radian(self.value);
    } else {
        settings.cameras.standard[cam_id][field_value_name] = MATH.degree_to_radian(self.value);
    }

    if (field_value_name == "yfov") {
        current_cam[field_value_name] = MATH.degree_to_radian(self.value);
    } else {
        current_cam[field_value_name] = self.value;
    }
    if (field_value != null) field_value.innerText = self.value;

    draw(true);
}
// Update camera position
const update_camera_pos = (self) => {
    let coord = self.getAttribute('data-coord')
    settings.cameras.position[coord] = self.value;

    draw(true);
}
// Reset camera
const reset_camera = (do_drawing) => {
    // Reset camera type
    for (let attr in current_cam.default) {
        let input = document.getElementById(attr);
        let input_value = document.getElementById(attr + "_value");

        if (input !== null) {
            if (attr == "aspectRatio" && settings.cameras.gltf.length == 0) {
                input.value = current_cam[attr] = optimal_aspect_ratio();
            } else {
                input.value = current_cam[attr] = current_cam.default[attr];
            }
        }

        if (input_value !== null) {
            if (attr == "yfov") {
                input.value = input_value.innerText = MATH.nice_radian_to_degree(current_cam.default[attr]);
                current_cam[attr] = current_cam.default[attr]
            } else {
                input_value.innerText = current_cam[attr] = current_cam.default[attr]
            }
        }
    }

    // Reset camera position
    document.getElementById('cam_pos_x').value = settings.cameras.position.x = settings.cameras.position.default.x;
    document.getElementById('cam_pos_y').value = settings.cameras.position.y = settings.cameras.position.default.y;
    document.getElementById('cam_pos_z').value = settings.cameras.position.z = settings.cameras.position.default.z;
    
    draw(true);
}
// Set best camera aspectRatio
const optimal_aspect_ratio = () => {
    return gl.canvas.clientWidth / gl.canvas.clientHeight;
}
// Set camera HTML input state
const cams_state = () => {
    let input_numbers = document.querySelectorAll('.number_controller');
    let input_ranges = document.querySelectorAll('.range_controller');

    for (let input_number of input_numbers) {
        let input = input_number.childNodes[0];
        if (input.nodeName == "INPUT") {
            input.disabled = draw_mode == null ? true : false;
        }
    }

    for (let input_range of input_ranges) {
        let input = input_range.childNodes[0];
        if (input.nodeName == "INPUT") {
            input.disabled = draw_mode == null ? true : false;
        }
    }

    all_cams.disabled = draw_mode == null ? true : false;

    let camera_reset_btn = document.getElementById('camera_reset_btn');
    camera_reset_btn.disabled = draw_mode == null ? true : false;
}

/*========================== Scene ===========================*/
// Get list of scene
const gui_scenes = (gltf_file) => {
    // Set default scene
    let current_scene_name;
    if (gltf_file.scenes.length > 1) {
        if (gltf_file.hasOwnProperty("scene")) {
            current_scene = gltf_file.scene;
            current_scene_name = gltf_file.scenes[gltf_file.scene].name || gltf_file.scene;
        } else {
            current_scene = 0;
            current_scene_name = gltf_file.scenes[0].name || 0;
        }
    } else if (gltf_file.scenes.length == 1) {
        current_scene = 0;
        current_scene_name = gltf_file.scenes[0].name || 0;
    } else {
        current_scene = -1;
        current_scene_name = "No scene";
    }

    // Create HTML options for select list
    let scene_list = document.getElementById('scene_list');
    scene_list.innerHTML = create_option(current_scene, current_scene_name);
    
    for (let i = 0; i < gltf_file.scenes.length; i++) {
        if (i != current_scene) {
            scene_list.innerHTML += create_option(i, gltf_file.scenes[i].name || i);
        }
    }
}
// Select scene
const select_scene = (self) => {
    current_scene = self.value;
    draw(false);
}

/*========================= Textures =========================*/
const gui_textures = (gltf_file) => {
    let gltf_textures_content = document.getElementById("gltf_textures_content");
    let gltf_textures_notice = document.getElementById("gltf_textures_notice");
    gltf_textures_content.innerHTML = "";

    if (gltf_file.images !== undefined && gltf_file.images.length > 0) {
        gltf_textures_notice.innerText = "";
        for (let image of gltf_file.images) {
            let html_image = image.data;
            // html_image.setAttribute('data-toggle', 'modal');
            // html_image.setAttribute('data-target', '#texture_zoom');
            html_image.setAttribute('onclick', 'show_image(this)')
            gltf_textures_content.appendChild(html_image);
        }
    } else {
        gltf_textures_notice.innerText = "No textures available"
    }
}

const show_image = (self) => {
    let image_wrapper = document.getElementById('image_wrapper');
    image_wrapper.innerHTML = "";

    let large_image = document.createElement('img')
    let image_source = self.getAttribute('src');
    large_image.setAttribute('src', image_source);

    image_wrapper.appendChild(large_image);

    jQuery('#texture_zoom').modal('toggle')
}

/*========================= Options ==========================*/
// Convert color from 0-255 to 0-1
const color_to_small = (big_color) => {
    let small_color = big_color / 255.0;
    if (small_color > 1.0) small_color = 1.0;
    if (small_color < 0.0) small_color = 0.0;

    return small_color;
}
// Convert color from 0-1 to 0-255
const color_to_big = (small_color) => {
    let big_color = Math.round(small_color * 255);
    if (big_color > 255) big_color = 255;
    if (big_color < 0) big_color = 0;

    return big_color;
}
// Update static color
const update_static_color = (self) => {
    let type = self.getAttribute('data-type');

    let red = color_to_small(document.getElementById(type + '_red').value);
    let green = color_to_small(document.getElementById(type + '_green').value);
    let blue = color_to_small(document.getElementById(type + '_blue').value);
    let alpha = document.getElementById(type + '_alpha').value;

    if (type == "static") {
        settings.static_color = [red, green, blue, alpha];
        if (draw_mode == MODE.zip && color_channel.value == 1) {
            draw(false);
        }
    }

    if (type == "bkgr") {
        settings.background_color = [red, green, blue, alpha];
        draw(false);
    }
}
// Prepare color fields
const gui_options_color = (colors, type) => {
    for (let i = 0; i < rgba_color.length; i++) {
        let color_field = document.getElementById(type + "_" + rgba_color[i]);

        if (rgba_color[i] != "alpha") {
            color_field.value = color_to_big(colors[i]);
        } else {
            color_field.value = colors[i];
        }

        if (type == "static") color_field.disabled =  draw_mode == MODE.zip ? false : true;
        if (type == "bkgr") color_field.disabled =  draw_mode != null ? false : true;
    }
}

/*================================== ZIP ==================================*/
// Read zip file from file browser
file_browser.addEventListener('change', async function(e) {
    show_spinner(true, true, "Unzipping file")
    draw_mode = MODE.zip;

    model_data = await handleFile(e.target.files[0]);

    if (model_data !== null && model_data !== undefined) {
        // Convert glTF file to JSON/JavaScript Object
        let gltf_txt = await model_data.gltf.async("string");
        GLTF_FILE.content_zip = JSON.parse(gltf_txt);

        // Convert images and bin files
        GLTF_FILE.set_data = model_data;

        console.log("=> Done reading zip.");
    } else {
        console.log("=> Not valid zip-file");
        show_spinner(false);
    }
});

// Check if there's an image
const check_valid_image = (filename) => {
    for (let mime_type in IMG_MIME_TYPE) {
        let img_types = IMG_MIME_TYPE[mime_type];
        for (img_type of img_types) {
            if (filename.endsWith("." + img_type)) {
                return true;
            }
        }
    }
    return false;
}

// Get the correct MIME-type for the given image
const get_img_mime_type = (img_extension) => {
    for (let mime_type in IMG_MIME_TYPE) {
        let img_types = IMG_MIME_TYPE[mime_type];
        for (img_type of img_types) {
            if (img_type == img_extension) {
                return "image/" + mime_type;
            }
        }
    }
    return null;
}

// Get file extension
const get_file_extension = (filename) => {
    let index = filename.lastIndexOf(".");
    return filename.slice(index + 1, filename.length);
}

// Get file name from uri
const get_file_name_from_uri = (filename) => {
    if (filename.includes("/")) {
        let index = filename.lastIndexOf("/");
        return filename.slice(index + 1, filename.length);
    } else {
        return filename;
    }
}

// Unzip and save files to the program
const handleFile = async (f) => {
    var dateBefore = new Date();    // Start loading time
    var files_content = document.getElementById('files_content');
    var zip_name = document.createElement('div');
    var zip_loaded_time = document.createElement('div');
    var zip_dir = document.createElement('ul');
    var data = {
        bin: [],
        images: []
    };
    var valid_zip = false;

    // Loading zip files
    await JSZip.loadAsync(f)
    .then(function(zip) {
        // Loop through everything inside the zip file
        zip.forEach(async function (relativePath, zipEntry) {
            let entry_name = zipEntry.name;
            let new_li = document.createElement('li');
            new_li.innerHTML = entry_name;
            zip_dir.appendChild(new_li);

            // If this is not a folder
            if (!zipEntry.dir) {
                if (entry_name.endsWith('.gltf')) {
                    // Get glTF file
                    valid_zip = true;
                    data.gltf = zipEntry;
                } else if (check_valid_image(entry_name)) {
                    // Get image/texture file
                    data.images.push(zipEntry);
                } else if (entry_name.endsWith('.bin')) {
                    // Get bin file
                    data.bin.push(zipEntry);
                } else {
                    // Don't take unnecessary file
                    console.log(entry_name + ' is an invalid file!!!');
                }
            }
        });
    }, function (e) {
        console.log(e.message);
    });

    // If zip-file is valid for glTF-model
    if (valid_zip) {
        // display file name
        zip_name.innerHTML = '<strong>File name: </strong>' + f.name;

        // Display files hierarchy
        let zip_structure = document.createElement('div');
        zip_structure.innerHTML = '<strong>Hierarchy:</strong>';
        zip_structure.appendChild(zip_dir);

        // Display loading time
        var dateAfter = new Date();     // End loading time
        var loading_time = dateAfter - dateBefore;
        zip_loaded_time.innerHTML = '<strong>Loading time: </strong>' + loading_time + 'ms';

        // Display details in GUI
        files_content.innerHTML = '';   // Clear details of the previous zip-file
        files_content.appendChild(zip_name);
        files_content.appendChild(zip_loaded_time);
        files_content.appendChild(zip_structure);
        
        return data;
    } else {
        return null;
    }
}