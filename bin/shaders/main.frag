#version 330 core

vec4 hsva(vec4 c){
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.x + K.xyz) * 6.0 - K.www);
    vec3 rgb = c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    return vec4(rgb, c.w);
}

// refractive indices
const float AIR = 1.000293;
const float HELIUM =1.000036;
const float HYDROGEN = 1.000132;
const float CO2 = 1.00045;
const float WATER = 1.333;
const float OLIVE_OIL = 1.47;
const float ICE = 1.31;
const float QUARTZ = 1.46;
const float ACRYLIC = 1.49;
const float PLEXIGLASS = 1.49;
const float GLASS = 1.52;
const float SAPPHIRE = 1.77;
const float DIAMOND = 2.417;
const float MOISSANITE = 2.65;

const int SHAPE_COUNT = 64;

// grey 0.1
// sky (135.0, 206.0, 235.0)/255.0
const vec3 BACKGROUND_COLOR = vec3(1.0, 1.0, 1.0);

// shape enum
const uint SPHERE = 0x00000001u;
const uint BOX = 0x00000002u;
const uint ROUNDBOX = 0x00000003u;

struct Shape{
    uint type;
    vec3 pos;
    vec3 size;
    vec3 subsize;
    vec3 color;
    float refractiveIndex;
    float opacity;
    mat4 orientation;
    // add texture
};

float smoothstep5(float x){
    if(x<0) return 0.0;
    if(x>1) return 1.0;
    return 6.0*x*x*x*x*x - 15.0*x*x*x*x + 10.0*x*x*x;
}



in vec4 gl_FragCoord;
out vec4 fragColor;

uniform float width;
uniform float height;

const int MAX_STEPS = 400;
const int MAX_REFRACT = 4;
const float epsilon = 0.000005;

float smoothmin(float x, float y){
	float k = 0.3;
    return min(x,y);
    float h = max(k-abs(x-y),0) / k;
    return min(x,y) - h*h*h*k*1/6.0;
}

/*
vec3 qtransform( vec4 q, vec3 v ){
    return v + 2.0*cross(cross(v, q.xyz ) + q.w*v, q.xyz);
}

vec4 qinverse(vec4 q){
    float size = length(q);
    vec4 nq = normalize(q);
    return size * (vec4(nq.x,0.0) - vec4(0.0,nq.yzw));
}*/

float sphereSD(vec3 p, vec3 center, float radius){
    return length(p-center) - radius;
}

float boxSD( vec3 p, vec3 center, vec3 dim, mat4 orientation )
{
    //vec3 newP = qtransform(qinverse(orientation),(p-center))
    vec4 newP = orientation*vec4((p-center).xyz,1);
    vec3 q = abs(newP.xyz) - dim;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float rboxSD( vec3 p, vec3 center, vec3 dim, float r, mat4 orientation )
{
    //vec3 newP = qtransform(qinverse(orientation),(p-center))
    vec4 newP = orientation*vec4((p-center).xyz,1);
    vec3 q = abs(newP.xyz) - dim + r;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

float dist(vec3 p, Shape shape){
    float dist;
    switch(shape.type){
        case SPHERE:
            dist = sphereSD(p,shape.pos,shape.size.x);
            break;
        case BOX:
            dist = boxSD(p,shape.pos,shape.size,shape.orientation);
            break;
        case ROUNDBOX:
            dist = rboxSD(p,shape.pos,shape.size,shape.subsize.x,shape.orientation);
            break;
        default:
            dist = 1e6;
            break;
    }
    return dist;
}

int getClosestShapeIndex(vec3 p, Shape shapes[SHAPE_COUNT], int shapeCount) {
    float minD = dist(p, shapes[0]);
    int minIndex = 0;
    for (int i = 1; i < shapeCount; i++) {
        float d = dist(p, shapes[i]);
        if (d < minD) {
            minD = d;
            minIndex = i;
        }
    }
    return minIndex;
}
vec3 getShapeNormal(vec3 p, Shape shape) {
    const float eps = 0.001;
    return normalize(vec3(
        dist(p + vec3(eps, 0.0, 0.0), shape) - dist(p - vec3(eps, 0.0, 0.0), shape),
        dist(p + vec3(0.0, eps, 0.0), shape) - dist(p - vec3(0.0, eps, 0.0), shape),
        dist(p + vec3(0.0, 0.0, eps), shape) - dist(p - vec3(0.0, 0.0, eps), shape)
    ));
    float d0 = dist(p, shape);
    float dx = dist(p + vec3(eps, 0.0, 0.0), shape);
    float dy = dist(p + vec3(0.0, eps, 0.0), shape);
    float dz = dist(p + vec3(0.0, 0.0, eps), shape);
    return normalize(vec3(dx - d0, dy - d0, dz - d0));
}


vec3 getNormal(vec3 p, Shape shapes[SHAPE_COUNT], int shapeCount){
    const float eps = 0.001;
    float dx = dist(p + vec3(eps, 0.0, 0.0), shapes[0]);
    float dy = dist(p + vec3(0.0, eps, 0.0), shapes[0]);
    float dz = dist(p + vec3(0.0, 0.0, eps), shapes[0]);
    float d0 = dist(p, shapes[0]);

    for (int i = 1; i < shapeCount; i++) {
        dx = smoothmin(dx, dist(p + vec3(eps, 0.0, 0.0), shapes[i]));
        dy = smoothmin(dy, dist(p + vec3(0.0, eps, 0.0), shapes[i]));
        dz = smoothmin(dz, dist(p + vec3(0.0, 0.0, eps), shapes[i]));
        d0 = smoothmin(d0, dist(p, shapes[i]));
    }

    vec3 n = vec3(dx - d0, dy - d0, dz - d0);
    return normalize(n);
}

float smoothW(float d, float radius){
        float sigma = max(0.2, radius * 1.0); // tune this
        // weight: 1 at inside, smoothly -> 0 at d >= sigma
        float w = 1.0 - smoothstep(0.0, sigma, d);
        // optional mild power to shape the falloff (makes blend less linear)
    return pow(w,1.0);
}

vec3 getColour(vec3 p, Shape shapes[SHAPE_COUNT], int shapeCount){
    vec3 blendedColor = vec3(0.0);
    float totalWeight = 0.0;

    for(int i = 0; i < shapeCount; i++) {
        float d = dist(p, shapes[i]);

        float w = smoothW(d, shapes[i].size.x);
        //float w = exp(-8.0 * max(d-0.001,0));
        blendedColor += shapes[i].color * w;
        totalWeight += w;
    }

    blendedColor /= totalWeight;
    return blendedColor;
}

vec2 getRefraction(vec3 p, Shape shapes[SHAPE_COUNT], int shapeCount){
    //float blendedRefract = 0.0;
    //float refWeight = 0.0;

    int minOpacity = 0;
    float minD = 10.0;

    for(int i = 0; i < shapeCount; i++) {
        float d = dist(p, shapes[i]);

        /*float w = smoothW(d, shapes[i].size.x);
        //float w = exp(-8.0 * max(d-0.001,0));

        blendedRefract += shapes[i].refractiveIndex * w;
        refWeight += w;*/

        if(d < minD) {
            minD = d;
            minOpacity = i;
        }
    }

    //blendedRefract /= refWeight;
    float refractd = shapes[minOpacity].refractiveIndex;
    float opacity = shapes[minOpacity].opacity;
    return vec2(refractd,opacity);
}

struct Ray{
    vec3 pos;
    vec3 colour;
    vec3 dir;
    int numSteps;
    vec3 normal;
};

Ray basicMarch(Ray ray, Shape shapes[SHAPE_COUNT], int shapeCount, float epsilon){
    float furthest = 0;
    for(int i=0;i<shapeCount;i++){
        furthest = max(furthest,length(shapes[i].pos-ray.pos)+length(shapes[i].size));
    }
    furthest += 10.0;

    // find first dist after "screen"
    float d = dist(ray.pos, shapes[0]);
    for(int i = 1; i < shapeCount; i++){
        d = smoothmin(d,dist(ray.pos, shapes[i]));
    }
    float D = d;
    float minD = d;
    float maxD = d;

    // loop moving ray
    while(d > epsilon && ray.numSteps < MAX_STEPS && D < furthest){
        ray.pos += ray.dir * max(d, epsilon);
        d = dist(ray.pos, shapes[0]);
        for(int i = 1; i < shapeCount; i++){
            d = smoothmin(d,dist(ray.pos, shapes[i]));
        }
        D += d;
        minD = min(minD,d);
        maxD = max(maxD,d);
        ray.numSteps ++;
    }

    if(d <= epsilon){
        int cIndex = getClosestShapeIndex(ray.pos, shapes, shapeCount);
        vec3 pointColour = shapes[cIndex].color;
        ray.normal = getShapeNormal(ray.pos,shapes[cIndex]);

        // AMBIANT
        vec3 ambiant = vec3(0.1,0.1,0.1) * pointColour;

        // DIFFUSE
        // TEMP LIGGHT DIRECION
        vec3 lightDir = normalize(vec3(0.1,2.0,-1.0));
        float diff = max(dot(ray.normal,lightDir), (1.0-shapes[cIndex].opacity)/3.0);
        vec3 diffuse = diff * vec3(1.0,1.0,1.0) * pointColour;

        ray.colour = vec3(ambiant + diffuse);
    }else{
        ray.colour =  BACKGROUND_COLOR;
        ray.normal = vec3(0.0);
    }

    return ray;
}

Ray refractMarch(Ray ray,Shape shapes[SHAPE_COUNT],int shapeCount,float epsilon,vec2 refractData){
    if(refractData.y >= 1.0) return ray;

    ray.dir = refract(ray.dir,ray.normal,AIR/refractData.x);
    ray.pos += ray.dir * epsilon;

    // find inside of which shape the ray is
    float minD = dist(ray.pos,shapes[0]);
    int minId = 0;
    for(int i = 1; i<shapeCount; i++){
        float d = dist(ray.pos,shapes[i]);
        if(d<minD){
            minD = d;
            minId = i;
        }
    }

    Shape s = shapes[minId];

    if(s.type == SPHERE){
        float r = s.size.x; // dist to sphere origin
        vec3 oc = ray.pos - s.pos; // orientation from the surface
        float b = dot(ray.dir, oc); // Barycentric coords at intersection
        float c = dot(oc, oc) - r*r; // Helmholtz equation
        float h = b*b - c; // Semi-major axis of the ellipse
        if(h > 0.0){
            h = sqrt(h);
            float t = -b + h; // first intersection along ray
            ray.pos += ray.dir * (t + 2.0 * epsilon);
        }else return ray;
    }else if(s.type == BOX){
        // Transform ray to local space of the box
        vec3 localRayPos = (s.orientation * vec4(ray.pos - s.pos, 1.0)).xyz;
        vec3 localRayDir = normalize((s.orientation * vec4(ray.dir, 0.0)).xyz);

        vec3 boxHalfSize = s.size;

        // Slab method
        vec3 invDir = 1.0 / localRayDir;
        vec3 tMin = (-boxHalfSize - localRayPos) * invDir;
        vec3 tMax = ( boxHalfSize - localRayPos) * invDir;

        vec3 t1 = min(tMin, tMax);
        vec3 t2 = max(tMin, tMax);

        float tNear = max(max(t1.x, t1.y), t1.z);
        float tFar  = min(min(t2.x, t2.y), t2.z);

        if(tFar < epsilon || tNear > tFar) return ray;

        float t = tFar; // exit point

        // Transform back to world space
        vec3 localExit = localRayPos + localRayDir * t;
        vec4 worldExit = inverse(s.orientation) * vec4(localExit, 1.0) + vec4(s.pos, 0.0);
        ray.pos = worldExit.xyz + ( 2 * epsilon ) * ray.dir;
    }else return ray;

    int cIndex = getClosestShapeIndex(ray.pos, shapes, shapeCount);
    ray.normal = getShapeNormal(ray.pos, shapes[cIndex]);

    ray.dir = refract(ray.dir,-ray.normal,refractData.x/AIR);
    ray.pos += 2.0 * ray.dir * epsilon;

    return ray;
}

vec4 raymarch(vec3 camera, vec3 pixel, Shape shapes[SHAPE_COUNT], int shapeCount, float epsilon){

    // direction of the ray
    vec3 dir = normalize(pixel - camera);

    vec3 p = camera;

    Ray ray;
    ray.pos = camera;
    ray.dir = dir;
    ray.numSteps = 0;

    // march ray until colision
    ray = basicMarch(ray,shapes,shapeCount,epsilon);

    // check for refractions
    vec3 colorStack[MAX_REFRACT];
    float opacityStack[MAX_REFRACT];
    int i = 0;
    vec2 refractData = getRefraction(ray.pos,shapes,shapeCount);
    while(length(ray.normal) > epsilon && ray.numSteps < MAX_STEPS && i < MAX_REFRACT && refractData.y < 1.0){
        // Add the shape colour and the refraction data on stacks
        colorStack[i] = ray.colour;
        opacityStack[i] = refractData.y;
        i++;

        // Do he refraction inside the shape, from entry point to exi point
        // After this, the ray is outside of the shape.
        ray = refractMarch(ray,shapes,shapeCount,epsilon,refractData);
        // Ray march again until another shape is hit
        ray = basicMarch(ray,shapes,shapeCount,epsilon);

        // What is the refraction index and opacity of the shape
        refractData = getRefraction(ray.pos,shapes,shapeCount);
    }

    vec3 color = ray.colour;
    for(int k = i - 1; k >= 0; --k){
        color = mix(color, colorStack[k], opacityStack[k]);
    }
    ray.colour = color;

    return vec4(ray.colour,1.0);
}

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

//uniform Shape shapes[SHAPE_COUNT];
//uniform int shapeCount;
uniform float time;

uniform mat4 rotation;
uniform mat4 orientation;


void main(){
    vec3 camera = vec3(0.0, 0.0, -3.0);
    vec3 pixelLoc = vec3((2.0)*gl_FragCoord.xy/height - (1.0)*vec2(width/height,1.0),0.0);

    Shape shapes[SHAPE_COUNT];
    int shapeCount = 0;

    float depth = 3.0;
	
	vec3 center = vec3(0.0, 0.0, depth + 0.0);
	float size = 1.0;
	float stepSize = size * 0.66;

	vec3 offsets[12] = vec3[](
		// XY plane (z = 0)
		vec3(-1.0, -1.0,  0.0),
		vec3(-1.0,  1.0,  0.0),
		vec3( 1.0, -1.0,  0.0),
		vec3( 1.0,  1.0,  0.0),

		// XZ plane (y = 0)
		vec3(-1.0,  0.0, -1.0),
		vec3(-1.0,  0.0,  1.0),
		vec3( 1.0,  0.0, -1.0),
		vec3( 1.0,  0.0,  1.0),

		// YZ plane (x = 0)
		vec3( 0.0, -1.0, -1.0),
		vec3( 0.0, -1.0,  1.0),
		vec3( 0.0,  1.0, -1.0),
		vec3( 0.0,  1.0,  1.0)
	);

	for(int i = 0; i < 12; i++)
	{
		vec3 rotatedOffset = (orientation * vec4(offsets[i], 0.0)).xyz;

		shapes[shapeCount].type = BOX;
		shapes[shapeCount].pos = center + stepSize*rotatedOffset;

		shapes[shapeCount].size = vec3(size * 0.33);

		shapes[shapeCount].subsize = vec3(0.0);
		shapes[shapeCount].color = vec3(0.5);

		shapes[shapeCount].refractiveIndex = GLASS;
		shapes[shapeCount].opacity = 0.9;

		shapes[shapeCount].orientation = orientation;

		shapeCount++;
	}

	shapes[shapeCount].type = SPHERE;
	shapes[shapeCount].pos = center;

	// tune this depending on your sponge scale
	shapes[shapeCount].size = vec3(stepSize * 0.8, 0.0, 0.0);

	shapes[shapeCount].subsize = vec3(0.0);
	shapes[shapeCount].color = vec3(0.1,0.6,0.1);

	shapes[shapeCount].refractiveIndex = GLASS;
	shapes[shapeCount].opacity = 0.9;

	shapes[shapeCount].orientation = mat4(1.0);

	shapeCount++;


    fragColor = raymarch(camera, pixelLoc, shapes, shapeCount, epsilon);

    
}
